#!/usr/bin/env bash
# Seeds the Tenant the local realm's `local-tenant` Organization maps to, with a Platform User for the
# realm's `dev` user, so a credential from that user resolves (docs/30-protocol/credential-resolution.md
# section 4). Run by smoke.sh; safe to run again against the same stack. Local development only.
set -euo pipefail
cd "$(dirname "$0")"

fail() {
  echo "✗ $1"
  docker compose logs --tail 40 postgres pgbouncer tenant-user-management-migrate
  exit 1
}

# Both are fixed in keycloak/orchestra-realm.json: the Organization's alias, and the dev user's id,
# which Keycloak issues as the subject of that user's tokens.
ORGANIZATION=local-tenant
DEV_SUBJECT=00000000-0000-4000-8000-000000000001
LOCAL_TENANT=00000000-0000-4000-8000-000000000100
SCHEMA=tenant_user_management

# No operation provisions Tenants yet, so the schema's owner writes the directory row itself.
docker compose exec -T postgres psql -X -q -v ON_ERROR_STOP=1 \
  "postgresql://tenant_user_management_owner:tenant-user-management-owner-local-dev@postgres:5432/orchestra" -c "
  INSERT INTO $SCHEMA.tenant_directory (tenant_id, status, identity_provider_organization)
  VALUES ('$LOCAL_TENANT', 'active', '$ORGANIZATION')
  ON CONFLICT DO NOTHING" >/dev/null || fail "could not seed the tenant directory"

# The Platform User is created as the service's own role, through the pool and in the Tenant's
# context, exactly as the service would: the Person and Membership only through the linking function.
# Linking and inserting are two statements, because the Principal's write policy looks for the
# Membership in its own statement's snapshot, where a Membership that statement created is not yet.
docker compose exec -T postgres psql -X -q -v ON_ERROR_STOP=1 \
  "postgresql://tenant_user_management_app:tenant-user-management-app-local-dev@pgbouncer:6432/orchestra" -c "
  BEGIN;
  SET LOCAL app.tenant_id = '$LOCAL_TENANT';
  SELECT FROM $SCHEMA.link_verified_person('$DEV_SUBJECT');
  INSERT INTO $SCHEMA.principal (tenant_id, id, kind, membership_id)
  SELECT m.tenant_id, gen_random_uuid(), 'platform-user', m.id
    FROM $SCHEMA.membership m
    JOIN $SCHEMA.person p ON p.id = m.person_id
   WHERE m.tenant_id = '$LOCAL_TENANT' AND p.verification = 'identity-provider' AND p.subject = '$DEV_SUBJECT'
  ON CONFLICT DO NOTHING;
  COMMIT;" >/dev/null || fail "could not seed the dev user's Platform User"

echo "✓ Tenant $LOCAL_TENANT answers for Organization $ORGANIZATION, with a Platform User for the dev user"
