#!/usr/bin/env bash
# Calls the identity probe through the edge as the local realm's dev user, in a new W3C trace, and
# prints the answer: one Principal in one Tenant once the stack is up and seeded (make up). The trace
# id it prints finds the request's spans in `make traces`. Local development only.
set -euo pipefail

token=$(curl -sf -X POST http://localhost:8080/realms/orchestra/protocol/openid-connect/token \
  -d grant_type=password -d client_id=orchestra-cli -d username=dev -d password=dev-local-only \
  -d scope=organization | python3 -c 'import json, sys; print(json.load(sys.stdin)["access_token"])') \
  || { echo "✗ no token from Keycloak at localhost:8080. Is the stack up? Try make up." >&2; exit 1; }

trace_id=$(python3 -c 'import secrets; print(secrets.token_hex(16))')
parent_id=$(python3 -c 'import secrets; print(secrets.token_hex(8))')
echo "trace ${trace_id}"
curl -s -i -H "Authorization: Bearer ${token}" -H "traceparent: 00-${trace_id}-${parent_id}-01" \
  http://localhost:9080/_probe/identity
echo
