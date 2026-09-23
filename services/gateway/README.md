# Gateway

The Data Plane's only ingress — the public HTTP and event-stream boundary
([`docs/30-protocol/gateway-api.md`](../../docs/30-protocol/gateway-api.md)).

**Phase 0.** One probe route, `GET /_probe/identity`, which proves the whole path: APISIX in front, a
bearer credential this service verifies itself against Keycloak's signing keys, and that
credential's resolution to one Principal in one Tenant by Tenant User Management. It is not part of
the Gateway contract, whose path layout
[ADR-0033](../../docs/adr/adr-0033-gateway-urls-follow-json-api-and-commands-are-created.md) fixes,
and it goes when the first real resource arrives.

**Resolution fails closed**
([`credential-resolution.md`](../../docs/30-protocol/credential-resolution.md)).
`src/orchestra_gateway/resolution.py` calls Tenant User Management as the `orchestra-gateway` client,
with a client credentials token it reuses until shortly before the token expires. Each resolution
has a deadline and repeats at most once: after a failure marked `safe`, after a connection that was
never made, or after a refused service token, which it replaces first. A credential that does not
resolve is refused like one that fails verification, and anything else short of a resolution is a
503 `upstream.unavailable`. `tests/test_resolution.py` checks the call against
`contracts/tenant-user-management.openapi.yaml`, a copy of that service's document that
`scripts/build-openapi.mjs --check` keeps identical (HC16).

**One HTTP contract** ([ADR-0025](../../docs/adr/adr-0025-json-api-http-contract.md)). Every response
is a JSON:API document. Every failure — an unknown path, a wrong method, a refused media type,
invalid input, a failed credential or an unhandled fault — leaves through
`src/orchestra_gateway/jsonapi.py` as an error document with a registered code and retry safety.
`tests/test_http_contract.py` validates real responses against `openapi.yaml`, a copy of
[`gateway.openapi.yaml`](../../docs/30-protocol/openapi/gateway.openapi.yaml) that
`scripts/build-openapi.mjs --check` keeps identical.

**Identity is never taken from the edge.** APISIX checks the token first, but a header it adds is
never read; the tests forge one and prove it is ignored ([ADR-0018](../../docs/adr/adr-0018-apisix-at-the-edge.md)).

**Every request is traced** ([`http-conventions.md`](../../docs/30-protocol/http-conventions.md)
HC12). `src/orchestra_gateway/tracing.py` serves each request in an OpenTelemetry server span whose
parent is a valid incoming `traceparent`, and makes the call to Tenant User Management and the token
request in client spans whose context those calls carry. It logs each request once, as a JSON line
with the trace, the span and the request identifier. Every line and span carries a tenant
identifier: the Tenant once the credential resolves, and otherwise the Nil UUID
([ADR-0028](../../docs/adr/adr-0028-telemetry-in-a-self-hosted-grafana-stack.md)), which no Tenant
has, so a resolution that names it fails closed. Nothing ever carries the Principal.
`tests/test_tracing.py` checks each of these, and which headers start a new trace instead.

## Working on it

This is an independent project ([ADR-0020](../../docs/adr/adr-0020-monorepo-with-enforced-service-boundaries.md)):
its own lockfile, its own tests, no imports from any other service. uv is pinned, so run it through
the pinned version rather than whatever is installed:

```bash
uvx uv@0.12.13 sync
uvx uv@0.12.13 run pytest
uvx uv@0.12.13 run ruff check && uvx uv@0.12.13 run ruff format --check
```

Configuration comes from the environment, and the service refuses to start without it. The
credentials it verifies need `ORCHESTRA_GATEWAY_ISSUER`, `ORCHESTRA_GATEWAY_JWKS_URL` and
`ORCHESTRA_GATEWAY_AUDIENCE`. Resolving them needs `ORCHESTRA_GATEWAY_TENANT_USER_MANAGEMENT_URL`,
`ORCHESTRA_GATEWAY_TOKEN_URL`, `ORCHESTRA_GATEWAY_CLIENT_ID` and `ORCHESTRA_GATEWAY_CLIENT_SECRET`,
and `ORCHESTRA_GATEWAY_RESOLUTION_DEADLINE_SECONDS` defaults to 5. Spans are exported over OTLP/HTTP
to `OTEL_EXPORTER_OTLP_ENDPOINT`, the variable OpenTelemetry specifies, when it is set.
