# Tenant User Management

Owns Tenants, Workspaces, Persons and Principals, and resolves a verified credential to exactly one
Principal and one Tenant for the Gateway
([ADR-0022](../../docs/adr/adr-0022-tenant-user-management-owns-tenancy.md)).

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

- **One Person per Tenant is the single source of a human's attributes.** A Platform User or an End
  User is built from its Person, so it takes the Person's Tenant by construction.
- **No foreign key constraints** ([ADR-0023](../../docs/adr/adr-0023-no-foreign-key-constraints.md)).
  References are identifiers; a cross-tenant reference is refused by the domain and, once the
  PostgreSQL adapter lands, by each table's write policy.
- **Resolution fails closed.** Anything short of one Principal and one Tenant is a rejection, and a
  rejection's reason is for logs, never for the caller.
- **No endpoint before its contract.** Only `/healthz` is served until the resolution contract is
  specified in `docs/30-protocol/`.

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

The PostgreSQL adapter, its schema, roles and forced row-level security; the resolution contract and
endpoint; and the Keycloak adapter.
