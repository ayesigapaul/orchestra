# Tenant User Management

Owns Tenants, Workspaces, Persons, Memberships and Principals, and resolves a verified credential to
exactly one Principal and one Tenant for the Gateway
([ADR-0024](../../docs/adr/adr-0024-global-person-with-tenant-memberships.md), which carries the
service decision of ADR-0022 forward).

## Structure — ports and adapters

| Layer | Path | May import |
| --- | --- | --- |
| Domain | `src/domain/` | Nothing outside the domain — no framework, driver or SDK |
| Application | `src/application/` | The domain; it defines the ports it needs |
| Adapters | `src/adapters/` | The application and the domain, plus the libraries they wrap |
| Composition root | `src/main.ts` | Everything; the only place configuration is read |

Reuse happens inside the service. Across services, rule B5 of
[ADR-0020](../../docs/adr/adr-0020-monorepo-with-enforced-service-boundaries.md) stands: nothing is
imported from another service.

## Rules this code holds to

- **One global Person per human, with a Membership per Tenant.** A Tenant sees a Person only through
  its own Membership. Only a subject the identity provider verified joins Memberships across Tenants;
  an End User vouched for by a customer's backend stays in the Tenant that asserted it.
- **A Person's name and email come only from the identity provider.** The function that records them
  accepts a verified Person and nothing else, so setting them from a Tenant's assertion does not
  compile.
- **Principals are built from a Membership and its Person**, never from bare identifiers, so they
  take the Membership's Tenant by construction. A Platform User needs a verified Person.
- **No way to attach a Person by identifier.** The `PersonLinker` port creates or reuses a Person and
  gives one Tenant a Membership, mirroring the database functions ADR-0024 specifies.
- **No foreign key constraints** ([ADR-0023](../../docs/adr/adr-0023-no-foreign-key-constraints.md)).
  References are identifiers; mismatched references are refused by the domain and, once the
  PostgreSQL adapter lands, by the database.
- **Resolution fails closed.** Anything short of one Principal and one Tenant is a rejection, and a
  rejection's reason is for logs, never for the caller.
- **No endpoint before its contract.** Only `/healthz` is served until the resolution contract is
  specified in `docs/30-protocol/`.
- **One HTTP contract** ([ADR-0025](../../docs/adr/adr-0025-json-api-http-contract.md)). Every
  response is a JSON:API document, and every failure an error document from
  `src/adapters/http/json-api.ts` with a registered code and retry safety. Operations are registered
  through its `resource()`, which answers a wrong method with 405 and refuses an undeclared query
  parameter. Tests validate real responses against `openapi.yaml`, a copy of this service's document
  in `docs/30-protocol/openapi/` that CI keeps identical.

## Commands

TypeScript runs directly on Node.js 24 by type stripping, so there is no build step. The compiler
enforces `erasableSyntaxOnly`, which rejects the syntax Node cannot strip, such as `enum`.

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm start          # PORT defaults to 8080
```

## Not yet here

The PostgreSQL adapter, with its schema, roles, forced row-level security and linking functions; the
identity-sync path; the resolution contract and endpoint; and the Keycloak adapter.
