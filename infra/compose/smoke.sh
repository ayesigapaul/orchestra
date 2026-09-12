#!/usr/bin/env bash
# Phase 0's exit criterion, end to end: an authenticated request crosses APISIX to the Gateway, and
# neither a missing credential nor an identity asserted in a header gets through.
set -euo pipefail
cd "$(dirname "$0")"

docker compose up -d --build --wait --wait-timeout 420

fail() { echo "✗ $1"; docker compose logs --tail 40 apisix gateway; exit 1; }

# APISIX loads apisix.yaml on a short poll after it starts; give the route a moment to appear.
for _ in $(seq 1 30); do
  code=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:9080/_probe/identity || true)
  [ "$code" = "401" ] && break
  sleep 2
done
[ "$code" = "401" ] || fail "no credential: expected 401 from the edge, got $code"
echo "✓ no credential is refused at the edge"

token=$(curl -sf -X POST http://localhost:8080/realms/orchestra/protocol/openid-connect/token \
  -d grant_type=password -d client_id=orchestra-cli -d username=dev -d password=dev-local-only \
  | python3 -c 'import json, sys; print(json.load(sys.stdin)["access_token"])') \
  || fail "could not obtain a token from Keycloak"

body=$(curl -s -H "Authorization: Bearer ${token}" http://localhost:9080/_probe/identity)
echo "$body" | grep -q '"subject"' || fail "valid credential: expected an identity, got: $body"
echo "✓ a verified credential crosses the edge and the Gateway: $body"

forged=$(printf '{"sub":"attacker"}' | base64)
code=$(curl -s -o /dev/null -w '%{http_code}' -H "X-Userinfo: ${forged}" http://localhost:9080/_probe/identity)
[ "$code" = "401" ] || fail "forged identity header: expected 401, got $code"
echo "✓ an identity asserted in a header is not a credential"

echo "Local stack passes."
