// The tenancy contract against PostgreSQL, through PgBouncer, as the service's own roles. It needs the
// local stack, so infra/compose/smoke.sh runs it in a container on the stack's network, where the
// database is reachable exactly as the service reaches it.
import { afterAll } from 'vitest';
import { connect } from '../../src/adapters/postgres/database.ts';
import { PostgresTenancy, PostgresTenantDirectory } from '../../src/adapters/postgres/tenancy.ts';
import { MembershipId, PersonId, TenantId } from '../../src/domain/identifiers.ts';
import type { Membership } from '../../src/domain/membership.ts';
import type { Person } from '../../src/domain/person.ts';
import { platformUserFor } from '../../src/domain/principal.ts';
import { describeTenancyAdapter } from '../adapters/tenancy-contract.ts';

const SCHEMA = 'tenant_user_management';

function required(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === '') {
    throw new Error(`${name} is not set: this suite runs on the local stack, through infra/compose/smoke.sh`);
  }
  return value;
}

// The service's own role through the pool, the identity-sync role through the pool, and the owner
// directly, which only seeds the tenant directory that no service role may write.
const options = {
  onIdleConnectionError: (error: Error) => console.error('a pooled database connection failed while idle', error),
};
const service = connect(required('DATABASE_URL'), options);
const identitySync = connect(required('IDENTITY_SYNC_DATABASE_URL'), options);
const owner = connect(required('OWNER_DATABASE_URL'), options);
afterAll(() => Promise.all([service.close(), identitySync.close(), owner.close()]));

interface PersonRow {
  id: string;
  verification: 'identity-provider' | 'tenant-asserted';
  subject: string;
  asserting_tenant_id: string | null;
  display_name: string | null;
  email: string | null;
}

function toPerson(row: PersonRow): Person {
  if (row.verification === 'identity-provider') {
    return {
      verification: 'identity-provider',
      id: PersonId(row.id),
      subject: row.subject,
      displayName: row.display_name ?? undefined,
      email: row.email ?? undefined,
    };
  }
  return {
    verification: 'tenant-asserted',
    id: PersonId(row.id),
    subject: row.subject,
    assertingTenantId: TenantId(row.asserting_tenant_id ?? ''),
  };
}

const PERSON_COLUMNS = 'id, verification, subject, asserting_tenant_id, display_name, email';

describeTenancyAdapter('PostgresTenancy, through PgBouncer', () => {
  const tenancy = new PostgresTenancy(service);
  return {
    linker: tenancy,
    principals: tenancy,
    directory: new PostgresTenantDirectory(service),

    addTenant: (entry) =>
      owner.withoutTenant(async (s) => {
        await s.query(
          `INSERT INTO ${SCHEMA}.tenant_directory (tenant_id, status, identity_provider_organization)
           VALUES ($1, $2, $3)`,
          [entry.tenantId, entry.status, entry.identityProviderOrganization],
        );
      }),

    addPlatformUser: (membership, id) =>
      service.inTenant(membership.tenantId, async (s) => {
        const [person] = await s.query<PersonRow>(
          `SELECT ${PERSON_COLUMNS} FROM ${SCHEMA}.person WHERE id = $1`,
          [membership.personId],
        );
        if (person === undefined) throw new Error('no Person visible for this Membership');
        const user = platformUserFor(membership, toPerson(person), id);
        await s.query(
          `INSERT INTO ${SCHEMA}.principal (tenant_id, id, kind, membership_id) VALUES ($1, $2, 'platform-user', $3)`,
          [user.tenantId, user.id, user.membershipId],
        );
        return user;
      }),

    recordIdentityProviderAttributes: (subject, attributes) =>
      identitySync.withoutTenant(async (s) => {
        await s.query(
          `UPDATE ${SCHEMA}.person SET display_name = $2, email = $3
            WHERE verification = 'identity-provider' AND subject = $1`,
          [subject, attributes.displayName, attributes.email ?? null],
        );
      }),

    personsVisibleTo: (tenantId) =>
      service.inTenant(tenantId, async (s) =>
        (await s.query<PersonRow>(`SELECT ${PERSON_COLUMNS} FROM ${SCHEMA}.person`)).map(toPerson),
      ),

    membershipsVisibleTo: (tenantId) =>
      service.inTenant(tenantId, async (s) =>
        (await s.query<{ tenant_id: string; id: string; person_id: string }>(
          `SELECT tenant_id, id, person_id FROM ${SCHEMA}.membership`,
        )).map(
          (row): Membership => ({
            tenantId: TenantId(row.tenant_id),
            id: MembershipId(row.id),
            personId: PersonId(row.person_id),
          }),
        ),
      ),
  };
});
