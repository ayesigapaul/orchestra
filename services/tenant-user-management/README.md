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
| Composition roots | `src/main.ts` for the service, `src/sync-identities.ts` for identity sync | Everything; the only places configuration is read |

Reuse happens inside the service. Across services, rule B5 of
[ADR-0020](../../docs/adr/adr-0020-monorepo-with-enforced-service-boundaries.md) stands: nothing is
imported from another service.

## Rules this code holds to

- **One global Person per human, with a Membership per Tenant.** A Tenant sees a Person only through
  its own Membership. Only a subject the identity provider verified joins Memberships across Tenants;
  an End User vouched for by a customer's backend stays in the Tenant that asserted it.
- **A Person's name and email come only from the identity provider.** The function that records them
  accepts a verified Person and nothing else, so setting them from a Tenant's assertion does not
  compile. Identity sync reads each verified Person's user from Keycloak as this service's own
  client, which can only read users. As the identity-sync role, it records the display name the
  realm holds, in its own order and script, and a verified email. It never composes a name from
  given and family names.
- **Principals are built from a Membership and its Person**, never from bare identifiers, so they
  take the Membership's Tenant by construction. A Platform User needs a verified Person.
- **No way to attach a Person by identifier.** The `PersonLinker` port creates or reuses a Person and
  gives one Tenant a Membership, mirroring the database functions ADR-0024 specifies.
- **No foreign key constraints** ([ADR-0023](../../docs/adr/adr-0023-no-foreign-key-constraints.md)).
  References are identifiers. A mismatched reference is refused by the domain, and in the
  database by a write policy or by the linking functions.
- **Resolution fails closed.** Anything short of one Principal and one Tenant is a rejection, and a
  rejection's reason is for logs, never for the caller.
- **Credential resolution trusts only what it verifies**
  ([`credential-resolution.md`](../../docs/30-protocol/credential-resolution.md)). The caller
  authenticates with its own token before its body is read, and the credential is verified again
  here against the identity provider's keys. Every rejection answers alike, whatever its reason.
  Keys that cannot be fetched are a 503, never a rejection, and a credential is never logged.
- **One HTTP contract** ([ADR-0025](../../docs/adr/adr-0025-json-api-http-contract.md)). Every
  response is a JSON:API document, and every failure an error document from
  `src/adapters/http/json-api.ts` with a registered code and retry safety. Operations are registered
  through its `resource()`, which answers a wrong method with 405 and refuses an undeclared query
  parameter. Tests validate real responses against `openapi.yaml`, a copy of this service's document
  in `docs/30-protocol/openapi/` that CI keeps identical.
- **Every request is traced** ([`http-conventions.md`](../../docs/30-protocol/http-conventions.md)
  HC12). `src/adapters/http/trace-context.ts` serves each request in an OpenTelemetry server span
  whose parent is a valid incoming `traceparent`, and logs it once with the trace and the span.
  Every line and span carries a tenant identifier: the Tenant a resolution names, and otherwise the
  Nil UUID ([ADR-0028](../../docs/adr/adr-0028-telemetry-in-a-self-hosted-grafana-stack.md)), which
  identity sync's lines carry too. Nothing carries a Principal. No Tenant may have the Nil UUID:
  the domain refuses it as a `TenantId`, and a constraint refuses it in the tenant directory.
  `src/adapters/telemetry/tracing.ts` installs the tracer provider, which exports over OTLP/HTTP
  when an endpoint is configured.

## Database

The service owns the `tenant_user_management` schema in the one logical datastore
([ADR-0021](../../docs/adr/adr-0021-postgresql-is-the-datastore.md)). Migrations live in
`db/migrations/`, and `db/Dockerfile` applies them with the pinned dbmate, strictly in order, as the
schema's owner. Provisioning creates the schema and four roles first, because creating a role needs
a superuser. `infra/compose/postgres/initdb/` does this for the local stack.

| Role | Can log in | What it may do |
| --- | --- | --- |
| `tenant_user_management_owner` | Yes | Run migrations; owns the tables, and forced row-level security binds it too |
| `tenant_user_management_app` | Yes | The service's connection. Reads within its Tenant, links Persons only through the functions, creates Principals; no bypass, owns nothing |
| `tenant_user_management_identity_sync` | Yes | Update a verified Person's name and email, and nothing else |
| `tenant_user_management_linker` | No | Own the linking functions, which run with its bypass so they can find a Person another Tenant already linked |

A Person has no creation timestamp, deliberately: a Tenant linking an existing Person would read in
it that the person was already known elsewhere.

## Commands

TypeScript runs directly on Node.js 24 by type stripping, so there is no build step. The compiler
enforces `erasableSyntaxOnly`, which rejects the syntax Node cannot strip, such as `enum`.

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test           # unit and adapter tests, the in-memory tenancy adapter among them
pnpm start          # needs the configuration below; PORT defaults to 8080
pnpm sync:identities # records the identity provider's attributes on every verified Person, then exits
```

| Variable | What it is |
| --- | --- |
| `DATABASE_URL` | The service's own role, through the pool |
| `IDENTITY_PROVIDER_ISSUER` | The issuer every token must carry |
| `IDENTITY_PROVIDER_JWKS_URL` | The identity provider's key set, where this service reaches it |
| `CREDENTIAL_AUDIENCE` | The audience a credential to resolve must name: the Gateway's |
| `SERVICE_AUDIENCE` | The audience a caller's own token must name; `tenant-user-management` by default |
| `RESOLUTION_CALLERS` | The clients that may resolve credentials, comma-separated; `orchestra-gateway` by default |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | Where spans are exported over OTLP/HTTP, under OpenTelemetry's own variable. Optional; unset, none is exported |

`pnpm sync:identities` reads its own configuration:

| Variable | What it is |
| --- | --- |
| `IDENTITY_SYNC_DATABASE_URL` | The identity-sync role, through the pool |
| `IDENTITY_PROVIDER_URL` | Where this service reaches Keycloak, such as `http://keycloak:8080` |
| `IDENTITY_PROVIDER_REALM` | The realm whose users are read |
| `IDENTITY_SYNC_CLIENT_ID` | This service's own client, which holds `view-users` and nothing else |
| `IDENTITY_SYNC_CLIENT_SECRET` | That client's secret |

`pnpm test:integration` runs the same tenancy contract against PostgreSQL, through PgBouncer, as the
service's own roles, and identity sync against the local realm. It needs the local stack's network,
so `infra/compose/smoke.sh` runs it in a
container built from `test/integration.Dockerfile`. Without its connection strings it fails rather
than skipping.

## Not yet here

When identity sync runs, which
[`identity-and-access.md`](../../docs/10-architecture/identity-and-access.md) section 12 registers as
open.
