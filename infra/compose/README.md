# Local stack

PostgreSQL, PgBouncer, Keycloak, Apache APISIX, the Gateway and Tenant User Management, each in its own container
([ADR-0020](../../docs/adr/adr-0020-monorepo-with-enforced-service-boundaries.md) rule B6), at the
versions pinned in [`docs/10-architecture/tech-stack.md`](../../docs/10-architecture/tech-stack.md).

```bash
infra/compose/smoke.sh                                  # bring it up and prove the path end to end
docker compose -f infra/compose/docker-compose.yml down -v   # tear it down, data included
```

| Port | What |
| --- | --- |
| 9080 | APISIX, the edge. The only way to reach the Gateway |
| 8080 | Keycloak. Admin console at `/admin`, user `admin` |

**Configuration is baked into images, never bind-mounted.** The Keycloak realm and the APISIX routes are copied in at build time, because a bind mount arrives empty when the Docker daemon's VM does not share this directory — which an external drive often is not. After editing either, rebuild; `smoke.sh` always does.

**Every refusal the edge makes is a JSON:API error document**
([ADR-0025](../../docs/adr/adr-0025-json-api-http-contract.md)), with the codes and titles the
services use. `apisix/orchestra/apisix/plugins/orchestra-json-api.lua` runs as a global rule and
reshapes what APISIX refuses itself — a missing, malformed or refused credential above all — and
drops the reason a token failed from `WWW-Authenticate`, because that reason belongs in the log.
Errors nginx raises before any plugin runs, such as a request with no `Host`, reach the same code
through a named location in `apisix/config.yaml`, which also loads only the plugins the routes use.
`smoke.sh` checks both paths.

**PgBouncer is built, not pulled.** The PgBouncer project publishes no container image, and the
widely pulled `pgbouncer/pgbouncer` belongs to a third party, so `pgbouncer/Dockerfile` installs the
pinned release from apt.postgresql.org and refuses to build unless the repository key matches its
pinned fingerprint. The pool runs in transaction mode, as
[ADR-0021](../../docs/adr/adr-0021-postgresql-is-the-datastore.md) assumes, and `smoke.sh` proves
it: tenant context set with `SET LOCAL` does not reach the next client, and a plain `SET` does.

**Each service owns a schema, and provisioning creates its roles.** Creating a role needs a
superuser, so `postgres/initdb/` creates Tenant User Management's schema and its four roles: an
owner that runs migrations, the service's own role with no bypass, an identity-sync role, and a
linker that cannot log in. The one-shot `tenant-user-management-migrate` job then applies the
service's migrations from `services/tenant-user-management/db/` as the owner. The service itself
starts only once that job has succeeded, with no published port. `smoke.sh` checks its health, runs
`tenant-isolation.sh`, and runs the service's integration suite in a container on the stack's
network. That script proves, through the pool and as the service's own roles, that two
Tenants cannot see or reference each other's rows
([ADR-0021](../../docs/adr/adr-0021-postgresql-is-the-datastore.md),
[ADR-0023](../../docs/adr/adr-0023-no-foreign-key-constraints.md),
[ADR-0024](../../docs/adr/adr-0024-global-person-with-tenant-memberships.md)).

**Credential resolution is proved end to end**
([`credential-resolution.md`](../../docs/30-protocol/credential-resolution.md)). The realm enables
Organizations: a `local-tenant` Organization holds the `dev` user, the `outsider` user belongs to
none, and the Gateway's confidential `orchestra-gateway` client authenticates through the client
credentials grant. `seed-local-tenant.sh` maps that Organization to a Tenant and gives `dev` a
Platform User in it. `smoke.sh` runs the seed before anything crosses the edge, and then checks:

- **Through the edge.** A credential from `dev` resolves to that Tenant. One from `outsider`, and one
  without the `organization` scope, are refused exactly as a failed credential is.
- **Tenant User Management directly.** Asked from the Gateway's container, it rejects those two and
  a forged credential alike, and refuses an end user's credential as a caller. No token reaches its
  log.
- **Failing closed.** While Tenant User Management is stopped, the Gateway answers 503 instead of
  letting a credential through.

**PostgreSQL's init scripts run only against an empty volume.** After changing `postgres/initdb/`,
or when a stack predates it, recreate the stack with `down -v`.

The Gateway and PgBouncer have no published port on purpose. **Every credential in this directory is
a throwaway local value**, and none of them may be reused anywhere else.
