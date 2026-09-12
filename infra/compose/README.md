# Local stack

PostgreSQL, Keycloak, Apache APISIX and the Gateway, each in its own container
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

The Gateway has no published port on purpose. **Every credential in this directory is a throwaway
local value**, and none of them may be reused anywhere else.
