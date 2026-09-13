---
title: OpenAPI Documents
doc_id: DOC-097
version: 0.2.0
status: Draft
last_updated: 2026-09-13
owners: [platform-architecture]
depends_on: [ADR-0025]
---

# OpenAPI Documents

One OpenAPI 3.1.2 document per service, describing its HTTP API under the response and error
contract of [`../http-conventions.md`](../http-conventions.md)
([ADR-0025](../../adr/adr-0025-json-api-http-contract.md)). They are the source of the API reference
on the published site, and they import directly into Postman, Insomnia and Bruno.

| Document | Service | Reached at, locally |
| --- | --- | --- |
| `gateway.openapi.yaml` | The Gateway — the public boundary | `http://localhost:9080`, through the edge, with a bearer credential |
| `tenant-user-management.openapi.yaml` | Tenant User Management — internal | `http://localhost:8080`, run with `pnpm start` |

## Testing from Postman, Insomnia or Bruno

1. **Import** the service's `.openapi.yaml` file. Postman creates a collection with every operation,
   its parameters and an example body for every documented response.
2. **Start what it calls.** For the Gateway, bring up the local stack with `infra/compose/smoke.sh`.
   For Tenant User Management, run `pnpm start` in `services/tenant-user-management`.
3. **Authenticate, where required.** The Gateway document declares an OAuth 2.0 password flow against
   the local Keycloak, so Postman's *Get New Access Token* fetches a token with the local stack's
   throwaway user, `dev` / `dev-local-only`, as client `orchestra-cli`. Those values exist only in
   `infra/compose` and work nowhere else.
4. **Read the response by its contract.** Success is a JSON:API document with `data` or `meta`; every
   failure has `errors`, and each error carries a `code` to branch on and a `meta.retry` saying
   whether sending the request again is safe.

## How these files are made

`src/` holds what people edit: one source per service, and `json-api.yaml` with the shared JSON:API
components every service uses. The `.openapi.yaml` files beside this README are generated from them,
self-contained so that a tool importing one file gets everything it needs:

```bash
node scripts/build-openapi.mjs          # rebuild the bundles and service copies after editing src/
node scripts/build-openapi.mjs --check  # what CI runs: fails on a stale bundle or copy, or a lint error
```

Each bundle is also copied to `services/<service>/openapi.yaml`, where the service's tests validate
its real responses against it, an unknown path, a wrong method and a refused media type included
([`../http-conventions.md`](../http-conventions.md) HC15). A service reads nothing outside its own
directory ([ADR-0020](../../adr/adr-0020-monorepo-with-enforced-service-boundaries.md)), so the copy
is what it reads, and the same check fails when a copy drifts.

Never edit a bundle or a copy by hand. An operation, and every code it can return, is documented here
before the endpoint ships ([`../http-conventions.md`](../http-conventions.md) HC14).
