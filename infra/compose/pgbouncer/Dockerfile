# PgBouncer in front of PostgreSQL, in transaction mode (ADR-0021).
#
# The PgBouncer project publishes no container image, and the widely pulled pgbouncer/pgbouncer image
# belongs to a third party. This one installs the pinned release from apt.postgresql.org — the
# PostgreSQL project's own packages, and the source the postgres image itself is built from — after
# checking the repository key against a pinned fingerprint. Configuration is baked in, never
# bind-mounted, for the same reason as the other images in this directory.

FROM debian:trixie-20260824-slim AS key
ARG PGDG_KEY_FINGERPRINT=B97B0AFCAA1A47F044F244A07FCC7D46ACCC4CF8
RUN set -eu; \
    apt-get update; \
    apt-get install -y --no-install-recommends ca-certificates curl gnupg; \
    curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc -o /tmp/pgdg.asc; \
    actual="$(gpg --batch --with-colons --show-keys /tmp/pgdg.asc | awk -F: '/^fpr:/ { print $10; exit }')"; \
    if [ "$actual" != "$PGDG_KEY_FINGERPRINT" ]; then \
      echo "apt.postgresql.org key fingerprint is '$actual', expected '$PGDG_KEY_FINGERPRINT'" >&2; \
      exit 1; \
    fi; \
    gpg --batch --dearmor -o /pgdg.gpg /tmp/pgdg.asc

FROM debian:trixie-20260824-slim
ARG PGBOUNCER_VERSION=1.25.2-1.pgdg13+1
COPY --from=key /pgdg.gpg /usr/share/keyrings/pgdg.gpg
# Plain HTTP is deliberate: apt verifies every package against the signed repository metadata, and
# this stage has no CA bundle until a package installs one.
RUN set -eu; \
    echo "deb [signed-by=/usr/share/keyrings/pgdg.gpg] http://apt.postgresql.org/pub/repos/apt trixie-pgdg main" \
      > /etc/apt/sources.list.d/pgdg.list; \
    apt-get update; \
    apt-get install -y --no-install-recommends "pgbouncer=${PGBOUNCER_VERSION}"; \
    rm -rf /var/lib/apt/lists/*; \
    id postgres
COPY pgbouncer.ini userlist.txt /etc/pgbouncer/
USER postgres
EXPOSE 6432
CMD ["pgbouncer", "/etc/pgbouncer/pgbouncer.ini"]
