#!/usr/bin/env bash
# Phase 0's exit criterion, end to end: an authenticated request crosses APISIX to the Gateway and
# resolves to one Principal in one Tenant, and neither a missing credential nor an identity asserted
# in a header gets through. Every answer, the edge's own refusals included, is a JSON:API document
# under ADR-0025.
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
  # Created first: a request that never connects writes neither, and reading a missing file would
  # end the script under set -e before the wait for the edge below could try again.
  : >"$out/body"
  : >"$out/headers"
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

# The probe resolves every credential through Tenant User Management (credential-resolution.md), so
# the local Tenant and its Platform User are seeded first.
./seed-local-tenant.sh
LOCAL_TENANT=00000000-0000-4000-8000-000000000100 # seed-local-tenant.sh maps local-tenant to it
fail_resolution() {
  echo "✗ $1"
  docker compose logs --tail 40 gateway tenant-user-management keycloak
  exit 1
}

# access_token <form fields>: an access token from the local realm's token endpoint.
access_token() {
  curl -sf -X POST http://localhost:8080/realms/orchestra/protocol/openid-connect/token "$@" \
    | python3 -c 'import json, sys; print(json.load(sys.stdin)["access_token"])'
}
# user_credential <username> <password> [scope]: that user's credential, from the local CLI client.
user_credential() {
  access_token -d grant_type=password -d client_id=orchestra-cli -d username="$1" -d password="$2" \
    ${3:+-d scope="$3"}
}

token=$(user_credential dev dev-local-only organization) || fail "could not obtain a token from Keycloak"
call -H "Authorization: Bearer ${token}" "$PROBE"
[ "$status" = "200" ] || fail_resolution "valid credential: expected 200, got $status: $body"
BODY=$body TENANT=$LOCAL_TENANT python3 -c '
import json, os
data = json.loads(os.environ["BODY"])["data"]
attributes = data["attributes"]
assert data["type"] == "identity-probes" and data["id"] == attributes["principal_id"] != ""
assert attributes["tenant_id"] == os.environ["TENANT"]
assert attributes["principal_kind"] == "platform-user"
' || fail_resolution "valid credential: expected dev's Platform User in the local Tenant, got: $body"
echo "✓ a verified credential crosses the edge and resolves to one Principal in one Tenant: $body"

outsider=$(user_credential outsider outsider-local-only organization) \
  || fail "could not obtain the outsider's credential"
unscoped=$(user_credential dev dev-local-only) \
  || fail "could not obtain a credential without the organization scope"
for credential in "$outsider" "$unscoped"; do
  call -H "Authorization: Bearer ${credential}" "$PROBE"
  expect_error 401 auth.unauthenticated
done
echo "✓ a verified credential that resolves to no Principal is refused like one that fails verification"

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

health=$(docker compose exec -T tenant-user-management wget -qO- http://127.0.0.1:8080/healthz) \
  || fail "Tenant User Management is not serving"
[ "$health" = '{"jsonapi":{"version":"1.1"},"meta":{"status":"ok"}}' ] \
  || fail "Tenant User Management health: expected its meta document, got: $health"
echo "✓ Tenant User Management serves once its migrations have run"

./row-level-security-control.sh
./tenant-isolation.sh

# --no-deps: the suite runs against the stack as it was brought up. Without it, compose recreated
# PostgreSQL, PgBouncer and the service in CI, which closed Keycloak's database connections under
# every check that followed.
docker compose --profile test run --rm --build --no-deps tenant-user-management-integration \
  || fail "Tenant User Management's integration suite failed"
echo "✓ both tenancy adapters pass one contract, the PostgreSQL one through the pool"

# The resolution contract itself (docs/30-protocol/credential-resolution.md), asked across the
# stack's network from the Gateway's container. Tokens are obtained again, because the checks above
# can outlast their lifetime.
gateway_token=$(access_token -d grant_type=client_credentials -d client_id=orchestra-gateway \
  -d client_secret=orchestra-gateway-local-dev) || fail_resolution "could not obtain the Gateway's own token"
dev_credential=$(user_credential dev dev-local-only organization) \
  || fail_resolution "could not obtain the dev user's credential"
unscoped_credential=$(user_credential dev dev-local-only) \
  || fail_resolution "could not obtain a credential without the organization scope"
outsider_credential=$(user_credential outsider outsider-local-only organization) \
  || fail_resolution "could not obtain the outsider's credential"

# resolve <caller token> <credential>: prints the status, a space, then the body.
resolve() {
  docker compose exec -T -e CALLER="$1" -e CREDENTIAL="$2" gateway python - <<'PY'
import json, os, urllib.error, urllib.request

document = {"data": {"type": "credential-resolutions", "attributes": {"credential": os.environ["CREDENTIAL"]}}}
request = urllib.request.Request(
    "http://tenant-user-management:8080/credential-resolutions",
    data=json.dumps(document).encode(),
    method="POST",
    headers={"Authorization": "Bearer " + os.environ["CALLER"], "Content-Type": "application/vnd.api+json"},
)
try:
    with urllib.request.urlopen(request, timeout=10) as response:
        print(response.status, response.read().decode())
except urllib.error.HTTPError as error:
    print(error.code, error.read().decode())
PY
}

# expect_resolution <outcome> <answer>: a credential-resolutions document with that outcome and, for a
# resolution, a Platform User in the local Tenant.
expect_resolution() {
  OUTCOME=$1 ANSWER=$2 TENANT=$LOCAL_TENANT python3 -c '
import json, os
status, _, body = os.environ["ANSWER"].partition(" ")
assert status == "200", status
data = json.loads(body)["data"]
assert data["type"] == "credential-resolutions"
if os.environ["OUTCOME"] == "resolved":
    attributes = data["attributes"]
    assert attributes["outcome"] == "resolved" and attributes["tenant_id"] == os.environ["TENANT"]
    assert attributes["principal_kind"] == "platform-user" and attributes["principal_id"]
else:
    assert data["attributes"] == {"outcome": "rejected"}
'
}

answer=$(resolve "$gateway_token" "$dev_credential")
expect_resolution resolved "$answer" \
  || fail_resolution "the dev user's credential should resolve in the local Tenant; got: $answer"
echo "✓ the Gateway resolves a verified credential to one Platform User in one Tenant"

for credential in "$outsider_credential" "$unscoped_credential" not-a-token; do
  answer=$(resolve "$gateway_token" "$credential")
  expect_resolution rejected "$answer" || fail_resolution "expected a rejection that gives no reason; got: $answer"
done
echo "✓ a user in no Organization, a credential naming none, and a forged one are rejected alike"

answer=$(resolve "$dev_credential" "$dev_credential")
[ "${answer%% *}" = "401" ] \
  || fail_resolution "an end user's credential must not authenticate a calling service; got: $answer"
echo "✓ an end user's credential does not authenticate a calling service"

# Captured first: grep -q stops reading early, which pipefail would report as the log command failing.
logs=$(docker compose logs tenant-user-management)
for secret in "$dev_credential" "$unscoped_credential" "$outsider_credential" "$gateway_token"; do
  if grep -qF -- "$secret" <<<"$logs"; then fail_resolution "a token reached Tenant User Management's log"; fi
done
echo "✓ no credential or token reaches Tenant User Management's log"

# Resolution fails closed (CR7): with Tenant User Management stopped, the Gateway answers 503 rather
# than letting the credential through, and it serves again once the service returns.
docker compose stop tenant-user-management >/dev/null 2>&1
call -H "Authorization: Bearer ${dev_credential}" "$PROBE"
expect_error 503 upstream.unavailable
docker compose start tenant-user-management >/dev/null 2>&1
for _ in $(seq 1 30); do
  call -H "Authorization: Bearer ${dev_credential}" "$PROBE"
  [ "$status" = "200" ] && break
  sleep 1
done
[ "$status" = "200" ] \
  || fail_resolution "the probe did not recover when Tenant User Management returned; got $status: $body"
echo "✓ the Gateway fails closed while Tenant User Management is unreachable, and recovers when it returns"

# A lost dependency is a 503, never a crash, and the service recovers when the dependency returns.
tum_status() {
  docker compose exec -T tenant-user-management node -e \
    "fetch('http://127.0.0.1:8080/healthz').then((r) => console.log(r.status), () => console.log('unreachable'))" \
    2>/dev/null || echo "not running"
}
docker compose stop pgbouncer >/dev/null 2>&1
status=$(tum_status)
[ "$status" = "503" ] || fail "with the pool stopped, Tenant User Management should answer 503; got '$status'"
docker compose start pgbouncer >/dev/null 2>&1
for _ in $(seq 1 30); do
  status=$(tum_status)
  [ "$status" = "200" ] && break
  sleep 1
done
[ "$status" = "200" ] || fail "Tenant User Management did not recover when the pool returned; got '$status'"
echo "✓ Tenant User Management answers 503 while its database is unreachable, and recovers when it returns"

echo "Local stack passes."
