# Gateway

The Data Plane's only ingress — the public HTTP and event-stream boundary
([`docs/30-protocol/gateway-api.md`](../../docs/30-protocol/gateway-api.md)).

**Phase 0.** One probe route, `GET /_probe/identity`, which proves the path: APISIX in front, then a
bearer credential this service verifies itself against Keycloak's signing keys. It is not part of the
Gateway contract, whose path layout is ADR-required and unmade, and it goes when the first real
resource arrives.

**One HTTP contract** ([ADR-0025](../../docs/adr/adr-0025-json-api-http-contract.md)). Every response
is a JSON:API document. Every failure — an unknown path, a wrong method, a refused media type,
invalid input, a failed credential or an unhandled fault — leaves through
`src/orchestra_gateway/jsonapi.py` as an error document with a registered code and retry safety.
`tests/test_http_contract.py` validates real responses against `openapi.yaml`, a copy of
[`gateway.openapi.yaml`](../../docs/30-protocol/openapi/gateway.openapi.yaml) that
`scripts/build-openapi.mjs --check` keeps identical.

**Identity is never taken from the edge.** APISIX checks the token first, but a header it adds is
never read; the tests forge one and prove it is ignored ([ADR-0018](../../docs/adr/adr-0018-apisix-at-the-edge.md)).

## Working on it

This is an independent project ([ADR-0020](../../docs/adr/adr-0020-monorepo-with-enforced-service-boundaries.md)):
its own lockfile, its own tests, no imports from any other service. uv is pinned, so run it through
the pinned version rather than whatever is installed:

```bash
uvx uv@0.12.13 sync
uvx uv@0.12.13 run pytest
uvx uv@0.12.13 run ruff check && uvx uv@0.12.13 run ruff format --check
```

Configuration comes from the environment: `ORCHESTRA_GATEWAY_ISSUER`, `ORCHESTRA_GATEWAY_JWKS_URL`
and `ORCHESTRA_GATEWAY_AUDIENCE`. The service refuses to start without them.
