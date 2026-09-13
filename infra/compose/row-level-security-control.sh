#!/usr/bin/env bash
# Runs the row-level security control against the migrated database, then proves it can fail. A probe
# schema that breaks each rule must be refused, with every problem named, and the control must pass
# again once the probe is gone. A control that cannot fail is not a control (multi-tenancy.md
# section 5). Run by smoke.sh.
set -euo pipefail
cd "$(dirname "$0")"

CONTROL=../../scripts/check-row-level-security.sql
fail() { echo "✗ $1"; exit 1; }
as_admin() { docker compose exec -T postgres psql -X -q -v ON_ERROR_STOP=1 -U keycloak -d orchestra "$@"; }

if ! out=$(as_admin -f - < "$CONTROL" 2>&1); then
  echo "$out"
  fail "the row-level security control failed on the migrated schema"
fi
echo "✓ the row-level security control passes on every service schema"

remove_probe() {
  as_admin >/dev/null 2>&1 <<'SQL' || true
DROP SCHEMA IF EXISTS rls_probe CASCADE;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'rls_probe_app') THEN
    DROP OWNED BY rls_probe_app;
  END IF;
END
$$;
DROP ROLE IF EXISTS rls_probe_app;
DROP ROLE IF EXISTS rls_probe_owner;
DROP ROLE IF EXISTS rls_probe_bypass;
SQL
}
trap remove_probe EXIT
remove_probe

# One of each thing the control exists to catch.
as_admin >/dev/null <<'SQL'
CREATE ROLE rls_probe_owner NOLOGIN;
CREATE ROLE rls_probe_app NOLOGIN NOBYPASSRLS;
CREATE ROLE rls_probe_bypass NOLOGIN BYPASSRLS;
CREATE SCHEMA rls_probe AUTHORIZATION rls_probe_owner;
CREATE TABLE rls_probe.tool (tenant_id uuid, id uuid, PRIMARY KEY (tenant_id, id));
CREATE TABLE rls_probe.widget (tenant_id uuid, id uuid PRIMARY KEY, tool_id uuid);
ALTER TABLE rls_probe.widget
  ADD CONSTRAINT widget_tool FOREIGN KEY (tenant_id, tool_id) REFERENCES rls_probe.tool (tenant_id, id);
GRANT USAGE ON SCHEMA rls_probe TO rls_probe_app;
GRANT INSERT ON rls_probe.widget TO rls_probe_app;
GRANT USAGE ON SCHEMA tenant_user_management TO rls_probe_app;
SQL

if out=$(as_admin -f - < "$CONTROL" 2>&1); then
  fail "the row-level security control passed a schema that breaks its rules"
fi
for expected in \
  "rls_probe.widget: row-level security is not both enabled and forced" \
  "rls_probe.tool: has no policy" \
  "rls_probe.widget: tenant_id is not in its primary key" \
  "rls_probe.widget.tool_id: a writable reference with no EXISTS in a write policy" \
  "rls_probe.widget (widget_tool): a foreign key constraint" \
  "role rls_probe_app: may use schema tenant_user_management" \
  "role rls_probe_bypass: bypasses row-level security"; do
  grep -qF "$expected" <<<"$out" || fail "the control did not report: $expected"
done

remove_probe
as_admin -f - < "$CONTROL" >/dev/null 2>&1 || fail "the control failed after the probe was removed"
echo "✓ the control refuses a schema that breaks each of its rules, so its pass means something"
