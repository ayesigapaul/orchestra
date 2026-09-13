// The tenant directory refuses the Nil UUID as a Tenant's identifier, because telemetry reserves it for
// work that belongs to no Tenant (ADR-0028). It needs the local stack, so infra/compose/smoke.sh runs
// it with the rest of the integration suite.
import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { connect } from '../../src/adapters/postgres/database.ts';

const ownerUrl = process.env['OWNER_DATABASE_URL'];
if (ownerUrl === undefined || ownerUrl === '') {
  throw new Error('OWNER_DATABASE_URL is not set: this suite runs on the local stack, through infra/compose/smoke.sh');
}

// The owner writes the directory, which no service role may, so it is the role the constraint must stop.
const owner = connect(ownerUrl, {
  onIdleConnectionError: (error: Error) => console.error('a pooled database connection failed while idle', error),
});
afterAll(() => owner.close());

describe('the tenant directory', () => {
  it('refuses the Nil UUID as a Tenant, even from the schema owner', async () => {
    await expect(
      owner.withoutTenant(async (s) => {
        await s.query(
          `INSERT INTO tenant_user_management.tenant_directory (tenant_id, status, identity_provider_organization)
           VALUES ($1, 'active', $2)`,
          ['00000000-0000-0000-0000-000000000000', `nil-uuid-${randomUUID()}`],
        );
      }),
    ).rejects.toThrow(/tenant_directory_tenant_id_is_not_nil/);
  });
});
