#!/usr/bin/env bash
# Two Tenants in one datastore, through the transaction-mode pool, as the service's own roles
# (ADR-0021, ADR-0023, ADR-0024). Neither Tenant reads or writes the other's rows, a reference to
# the other's row fails exactly as a missing one does, and a Person spans Tenants only as ADR-0024
# allows. Run by smoke.sh; safe to run again against the same stack.
set -euo pipefail
cd "$(dirname "$0")"

fail() {
  echo "✗ $1"
  docker compose logs --tail 40 postgres pgbouncer tenant-user-management-migrate
  exit 1
}

TENANT_A=00000000-0000-4000-8000-00000000000a
TENANT_B=00000000-0000-4000-8000-00000000000b
RUN=$(date +%s)$$
SCHEMA=tenant_user_management

# Each call is its own client of the pool, as a request is.
pooled() {
  docker compose exec -T postgres psql -X -q -t -A -v ON_ERROR_STOP=1 \
    "postgresql://$1@pgbouncer:6432/orchestra" -c "$2"
}
as_service() { pooled "tenant_user_management_app:tenant-user-management-app-local-dev" "$1"; }
as_identity_sync() {
  pooled "tenant_user_management_identity_sync:tenant-user-management-identity-sync-local-dev" "$1"
}
in_tenant() { as_service "BEGIN; SET LOCAL app.tenant_id = '$1'; $2; COMMIT;"; }
# The first error line psql reports, so two refusals can be compared word for word.
error_of() { grep -m1 "ERROR" <<<"$1" || true; }

docker compose exec -T postgres psql -X -q -v ON_ERROR_STOP=1 -U keycloak -d orchestra -c "
  INSERT INTO $SCHEMA.tenant_directory (tenant_id, status, identity_provider_organization)
  VALUES ('$TENANT_A', 'active', 'isolation-check-a'), ('$TENANT_B', 'active', 'isolation-check-b')
  ON CONFLICT DO NOTHING" >/dev/null || fail "could not seed the tenant directory"

membership_a=$(in_tenant "$TENANT_A" "SELECT membership_id FROM $SCHEMA.link_verified_person('ada-$RUN')") \
  || fail "Tenant A could not link a verified subject"
seen=$(in_tenant "$TENANT_A" "SELECT count(*) FROM $SCHEMA.person WHERE subject = 'ada-$RUN' AND display_name IS NULL")
[ "$seen" = "1" ] || fail "Tenant A should see its linked Person, with no attribute a Tenant supplied; saw $seen"
echo "✓ a Tenant links a verified subject and sees the Person, carrying no attribute a Tenant supplied"

seen=$(in_tenant "$TENANT_B" "SELECT (SELECT count(*) FROM $SCHEMA.person WHERE subject = 'ada-$RUN')
                                   + (SELECT count(*) FROM $SCHEMA.membership WHERE id = '$membership_a')")
[ "$seen" = "0" ] || fail "Tenant B, with no Membership, saw $seen of Tenant A's rows"
echo "✓ another Tenant, with no Membership, sees neither the Person nor the Membership"

seen=$(as_service "SELECT count(*) FROM $SCHEMA.membership")
[ "$seen" = "0" ] || fail "with no tenant context, $seen Memberships were visible"
if out=$(as_service "SELECT $SCHEMA.link_verified_person('eve-$RUN')" 2>&1); then
  fail "a Person was linked with no tenant context"
fi
grep -q "no tenant context" <<<"$out" || fail "linking with no tenant context failed for the wrong reason: $out"
echo "✓ with no tenant context nothing is visible, and nothing can be linked"

if out=$(in_tenant "$TENANT_A" "UPDATE $SCHEMA.person SET display_name = 'Claimed by A' WHERE subject = 'ada-$RUN'" 2>&1); then
  fail "the service's role changed a global attribute"
fi
grep -q "permission denied" <<<"$out" || fail "a global attribute write failed for the wrong reason: $out"
if out=$(in_tenant "$TENANT_A" "INSERT INTO $SCHEMA.membership (tenant_id, id, person_id)
                                VALUES ('$TENANT_A', gen_random_uuid(), gen_random_uuid())" 2>&1); then
  fail "the service's role wrote a Membership directly"
fi
grep -q "permission denied" <<<"$out" || fail "a direct Membership write failed for the wrong reason: $out"
echo "✓ the service's role can neither set a global attribute nor write a Membership directly"

as_identity_sync "UPDATE $SCHEMA.person SET display_name = 'Ada Lovelace', email = 'ada@example.test'
                   WHERE verification = 'identity-provider' AND subject = 'ada-$RUN'" >/dev/null \
  || fail "identity sync could not record the identity provider's attributes"
person_a=$(in_tenant "$TENANT_A" "SELECT id FROM $SCHEMA.person WHERE subject = 'ada-$RUN'")
person_b=$(in_tenant "$TENANT_B" "SELECT person_id FROM $SCHEMA.link_verified_person('ada-$RUN')")
[ -n "$person_a" ] && [ "$person_a" = "$person_b" ] || fail "two Tenants linking one verified subject got two Persons"
name=$(in_tenant "$TENANT_B" "SELECT display_name FROM $SCHEMA.person WHERE id = '$person_b'")
[ "$name" = "Ada Lovelace" ] || fail "Tenant B should see the identity provider's name; saw '$name'"
echo "✓ a verified subject joins one Person across Tenants, named only by the identity provider"

asserted_a=$(in_tenant "$TENANT_A" "SELECT person_id FROM $SCHEMA.link_asserted_person('customer-user-$RUN')")
asserted_b=$(in_tenant "$TENANT_B" "SELECT person_id FROM $SCHEMA.link_asserted_person('customer-user-$RUN')")
[ "$asserted_a" != "$asserted_b" ] || fail "two Tenants asserting one subject got one Person"
claimed=$(in_tenant "$TENANT_B" "SELECT person_id FROM $SCHEMA.link_asserted_person('ada-$RUN')")
[ "$claimed" != "$person_a" ] || fail "an asserted subject reached a verified Person"
echo "✓ an asserted subject stays in the Tenant that asserted it, and never claims a verified Person"

membership_b=$(in_tenant "$TENANT_B" "SELECT membership_id FROM $SCHEMA.link_verified_person('ada-$RUN')")
in_tenant "$TENANT_A" "INSERT INTO $SCHEMA.principal (tenant_id, id, kind, membership_id)
                       VALUES ('$TENANT_A', gen_random_uuid(), 'platform-user', '$membership_a')" >/dev/null \
  || fail "Tenant A could not create a Principal on its own Membership"
if cross=$(in_tenant "$TENANT_A" "INSERT INTO $SCHEMA.principal (tenant_id, id, kind, membership_id)
                                  VALUES ('$TENANT_A', gen_random_uuid(), 'end-user', '$membership_b')" 2>&1); then
  fail "Tenant A created a Principal on Tenant B's Membership"
fi
if missing=$(in_tenant "$TENANT_A" "INSERT INTO $SCHEMA.principal (tenant_id, id, kind, membership_id)
                                    VALUES ('$TENANT_A', gen_random_uuid(), 'end-user', gen_random_uuid())" 2>&1); then
  fail "Tenant A created a Principal on a Membership that exists nowhere"
fi
grep -q "violates row-level security policy" <<<"$cross" || fail "the cross-tenant reference failed for the wrong reason: $cross"
[ "$(error_of "$cross")" = "$(error_of "$missing")" ] \
  || fail "a reference to another Tenant's row was refused differently from a missing one: '$(error_of "$cross")' vs '$(error_of "$missing")'"
if out=$(in_tenant "$TENANT_A" "INSERT INTO $SCHEMA.principal (tenant_id, id, kind, name)
                                VALUES ('$TENANT_B', gen_random_uuid(), 'service-account', 'claims B')" 2>&1); then
  fail "Tenant A wrote a row claiming Tenant B"
fi
echo "✓ a reference to another Tenant's Membership is refused exactly as a missing one, and no row claims another Tenant"

echo "Tenant isolation holds through the pool."
