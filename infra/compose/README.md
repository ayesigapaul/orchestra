# Local stack

PostgreSQL, PgBouncer, Keycloak, Apache APISIX and the Gateway, each in its own container
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

**PgBouncer is built, not pulled.** The PgBouncer project publishes no container image, and the
widely pulled `pgbouncer/pgbouncer` belongs to a third party, so `pgbouncer/Dockerfile` installs the
pinned release from apt.postgresql.org and refuses to build unless the repository key matches its
pinned fingerprint. The pool runs in transaction mode, as
[ADR-0021](../../docs/adr/adr-0021-postgresql-is-the-datastore.md) assumes, and `smoke.sh` proves
it: tenant context set with `SET LOCAL` does not reach the next client, and a plain `SET` does.

**PostgreSQL's init scripts run only against an empty volume.** After changing `postgres/initdb/`,
or when a stack predates it, recreate the stack with `down -v`.

The Gateway and PgBouncer have no published port on purpose. **Every credential in this directory is
a throwaway local value**, and none of them may be reused anywhere else.
