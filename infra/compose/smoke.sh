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

# ADR-0021: tenant context is set with SET LOCAL because the pool is in transaction mode. Each call
# below is a separate client, and the probe pool holds a single server connection, so every client
# is handed the same one — which is exactly the case isolation has to survive.
fail_pool() { echo "✗ $1"; docker compose logs --tail 40 postgres pgbouncer; exit 1; }
pool() {
  docker compose exec -T postgres psql -X -q -t -A \
    "postgresql://pooler_probe:pooler-probe-local-dev@pgbouncer:6432/orchestra_probe" -c "$1"
}
probe="SELECT coalesce(current_setting('app.tenant_id', true), '<never set>')"

pool "BEGIN; SET LOCAL app.tenant_id = 'tenant-a'; COMMIT;" >/dev/null \
  || fail_pool "could not reach PostgreSQL through PgBouncer"
seen=$(pool "$probe") || fail_pool "could not query through PgBouncer"
[ "$seen" != "tenant-a" ] || fail_pool "tenant context set with SET LOCAL reached the next client"
echo "✓ tenant context set with SET LOCAL does not reach the next client through the pool"

pool "SET app.tenant_id = 'session-state'" >/dev/null
seen=$(pool "$probe")
pool "RESET app.tenant_id" >/dev/null
[ "$seen" = "session-state" ] \
  || fail_pool "expected transaction pooling to hand a plain SET to the next client, got '$seen'"
echo "✓ the pool is in transaction mode: a plain SET does reach the next client, which is why it is forbidden"

echo "Local stack passes."
