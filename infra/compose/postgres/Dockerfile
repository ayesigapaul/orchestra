# PostgreSQL for the local stack, with its init scripts baked in rather than bind-mounted, for the
# same reason as the Keycloak and APISIX images. Init scripts run only against an empty data
# directory, so after changing one, recreate the volume with `docker compose down -v`.
FROM postgres:18.6
COPY initdb/ /docker-entrypoint-initdb.d/
