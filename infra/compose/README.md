# Local stack

PostgreSQL, PgBouncer, Keycloak, Apache APISIX, the Gateway, Tenant User Management, an OpenTelemetry Collector, Grafana Tempo and Grafana, each in its own container
([ADR-0020](../../docs/adr/adr-0020-monorepo-with-enforced-service-boundaries.md) rule B6), at the
versions pinned in [`docs/10-architecture/tech-stack.md`](../../docs/10-architecture/tech-stack.md).

```bash
make up      # build, start and seed the stack, waiting until it is healthy
make probe   # call the identity probe through the edge as the dev user, in a new trace
make smoke   # bring it up and prove the path end to end, as CI does
make down    # stop it and keep its data; make reset deletes the data and starts again
```

`make` on its own lists every target, among them `make logs SERVICE=gateway` and `make traces`. Each
runs the commands this directory documents, so `infra/compose/smoke.sh` and
`docker compose -f infra/compose/docker-compose.yml` work just as well without it.

| Port | What |
| --- | --- |
| 9080 | APISIX, the edge. The only way to reach the Gateway |
| 8080 | Keycloak. Admin console at `/admin`, user `admin` |
| 3000 | Grafana, reading the traces in Tempo. Published on this machine only, and with no login |

**Configuration is baked into images, never bind-mounted.** The Keycloak realm and the APISIX routes are copied in at build time, because a bind mount arrives empty when the Docker daemon's VM does not share this directory — which an external drive often is not. After editing either, rebuild; `smoke.sh` always does.

**Every refusal the edge makes is a JSON:API error document**
([ADR-0025](../../docs/adr/adr-0025-json-api-http-contract.md)), with the codes and titles the
services use. `apisix/orchestra/apisix/plugins/orchestra-json-api.lua` runs as a global rule and
reshapes what APISIX refuses itself — a missing, malformed or refused credential above all — and
drops the reason a token failed from `WWW-Authenticate`, because that reason belongs in the log.
Errors nginx raises before any plugin runs, such as a request with no `Host`, reach the same code
through locations in `apisix/config.yaml`, which also loads only the plugins the routes use.
`smoke.sh` checks both paths.

**The edge limits request sizes.** Content over 1 MiB is refused with 413 by the `client-control`
global rule, before any credential is checked. A request line or a header field over 8 KiB is
refused by nginx with 414 or 431, and nginx's own 494 for an oversized header field is answered as
the 431 of RFC 6585. Each is a JSON:API error with its registered code, and `smoke.sh` sends all
three.

**Every request is traced across the stack**
([`http-conventions.md`](../../docs/30-protocol/http-conventions.md) HC12). APISIX's
`opentelemetry` plugin, as a global rule, serves each request in a span whose parent is a valid
incoming `traceparent`, and passes its own span to the Gateway as the parent; each service does the
same for the calls it receives. Every span goes to `otel-collector` over OTLP/HTTP. Its debug
exporter prints each one, so `make traces` shows a trace hop by hop, and it sends each span on to
Tempo, which Grafana reads at http://localhost:3000
([ADR-0028](../../docs/adr/adr-0028-telemetry-in-a-self-hosted-grafana-stack.md)). Grafana has no
login, so its port is published on this machine alone. The edge's access log is one JSON line per
request, carrying its trace and span under the names the services log with. Every line, the edge's
and the services', carries a tenant identifier, and a line for work with no Tenant carries the Nil
UUID; the edge never knows a Tenant, so all its lines do. `smoke.sh` sends a trace through the
edge, then checks the chain of spans, each hop's log line for the request, the Nil UUID on lines
with no Tenant, the trace in Tempo, and Grafana reading Tempo.

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
network, which also reads the realm's `dev` user through the Keycloak adapter and records it as the
identity-sync role. `tenant-isolation.sh` proves, through the pool and as the service's own roles,
that two Tenants cannot see or reference each other's rows
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

**Names follow international standards.** The realm's user profile gives each user a display name,
kept in its own order and script, and requires neither a given nor a family name, because a mononym
has no family name and some cultures put it first. Identity sync records that display name, or the
username when there is none.

**PostgreSQL's init scripts run only against an empty volume.** After changing `postgres/initdb/`,
or when a stack predates it, recreate the stack with `down -v`.

The Gateway and PgBouncer have no published port on purpose. **Every credential in this directory is
a throwaway local value**, and none of them may be reused anywhere else.
