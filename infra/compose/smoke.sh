#!/usr/bin/env bash
# Phase 0's exit criterion, end to end: an authenticated request crosses APISIX to the Gateway, and
# neither a missing credential nor an identity asserted in a header gets through. Every answer, the
# edge's own refusals included, is a JSON:API document under ADR-0025.
set -euo pipefail
cd "$(dirname "$0")"

docker compose up -d --build --wait --wait-timeout 420

fail() { echo "✗ $1"; docker compose logs --tail 40 apisix gateway; exit 1; }

EDGE=http://localhost:9080
PROBE=$EDGE/_probe/identity

# call <curl arguments>: sends one request, keeping its status, headers and body.
call() {
  local out
  out=$(mktemp -d)
  status=$(curl -s -o "$out/body" -D "$out/headers" -w '%{http_code}' "$@" || true)
  headers=$(tr -d '\r' < "$out/headers")
  body=$(cat "$out/body")
  rm -rf "$out"
}

# expect_error <status> <code>: the last answer is a JSON:API error document carrying that code, and
# its id is the request identifier the response carries.
expect_error() {
  [ "$status" = "$1" ] || fail "expected $1 $2, got $status: $body"
  grep -qix 'content-type: application/vnd.api+json' <<<"$headers" \
    || fail "expected the JSON:API media type with $2, got: $headers"
  local id
  id=$(awk -F': ' 'tolower($1) == "orchestra-request-id" { print $2 }' <<<"$headers")
  BODY=$body CODE=$2 ID=$id python3 -c '
import json, os
document = json.loads(os.environ["BODY"])
[error] = document["errors"]
assert document["jsonapi"] == {"version": "1.1"}
assert error["code"] == os.environ["CODE"] and error["id"] == os.environ["ID"] != ""
assert error["meta"]["retry"] in ("safe", "unsafe", "indeterminate")
' || fail "expected a JSON:API error document with code $2, got: $body"
}

# APISIX loads apisix.yaml on a short poll after it starts; give the route a moment to appear.
for _ in $(seq 1 30); do
  call "$PROBE"
  [ "$status" = "401" ] && break
  sleep 2
done
expect_error 401 auth.unauthenticated
echo "✓ no credential is refused at the edge, as a JSON:API error"

call -H "Authorization: Bearer not-a-token" "$PROBE"
expect_error 401 auth.unauthenticated
if grep -qi '^www-authenticate:.*error_description' <<<"$headers"; then
  fail "a refused token's reason reached the caller: $headers"
fi
echo "✓ a refused token is not told why"

token=$(curl -sf -X POST http://localhost:8080/realms/orchestra/protocol/openid-connect/token \
  -d grant_type=password -d client_id=orchestra-cli -d username=dev -d password=dev-local-only \
  | python3 -c 'import json, sys; print(json.load(sys.stdin)["access_token"])') \
  || fail "could not obtain a token from Keycloak"

call -H "Authorization: Bearer ${token}" "$PROBE"
[ "$status" = "200" ] && grep -q '"type":"identity-probes"' <<<"$body" \
  || fail "valid credential: expected an identity-probes resource, got $status: $body"
echo "✓ a verified credential crosses the edge and the Gateway: $body"

call -H "Authorization: Bearer ${token}" "$EDGE/no-such-path"
expect_error 404 resource.not_found
echo "✓ the Gateway's own errors reach the caller through the edge unchanged"

forged=$(printf '{"sub":"attacker"}' | base64)
call -H "X-Userinfo: ${forged}" "$PROBE"
expect_error 401 auth.unauthenticated
echo "✓ an identity asserted in a header is not a credential"

# An HTTP/1.1 request without a Host header is refused by nginx before any plugin runs.
call -H "Host:" "$EDGE/healthz"
expect_error 400 request.malformed
echo "✓ errors nginx raises itself are JSON:API errors too"

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
