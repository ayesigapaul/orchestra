// Identity sync against the local realm (ADR-0017, ADR-0024). The Keycloak adapter reads the realm's
// dev user as this service's own client, and the identity-sync role records the result through the
// pool. infra/compose/smoke.sh runs it with the rest of the integration suite, on the stack's network.
import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { KeycloakUsers } from '../../src/adapters/identity-provider/keycloak-users.ts';
import { connect } from '../../src/adapters/postgres/database.ts';
import { PostgresTenancy } from '../../src/adapters/postgres/tenancy.ts';
import { PostgresVerifiedPersons } from '../../src/adapters/postgres/verified-persons.ts';
import { DependencyUnavailable } from '../../src/application/errors.ts';
import { synchronizeIdentity } from '../../src/application/synchronize-identity.ts';
import { TenantId } from '../../src/domain/identifiers.ts';

const SCHEMA = 'tenant_user_management';
// Fixed in infra/compose/keycloak/orchestra-realm.json, which Keycloak issues as the dev user's subject.
const DEV_SUBJECT = '00000000-0000-4000-8000-000000000001';

function required(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === '') {
    throw new Error(`${name} is not set: this suite runs on the local stack, through infra/compose/smoke.sh`);
  }
  return value;
}

const options = {
  onIdleConnectionError: (error: Error) => console.error('a pooled database connection failed while idle', error),
};
const service = connect(required('DATABASE_URL'), options);
const identitySync = connect(required('IDENTITY_SYNC_DATABASE_URL'), options);
afterAll(() => Promise.all([service.close(), identitySync.close()]));

const keycloak = (clientSecret = required('IDENTITY_SYNC_CLIENT_SECRET')) =>
  new KeycloakUsers({
    baseUrl: required('IDENTITY_PROVIDER_URL'),
    realm: required('IDENTITY_PROVIDER_REALM'),
    clientId: required('IDENTITY_SYNC_CLIENT_ID'),
    clientSecret,
  });

const synchronize = () =>
  synchronizeIdentity({ persons: new PostgresVerifiedPersons(identitySync), identityProvider: keycloak() });

describe('identity sync against the local realm', () => {
  it("records the realm's name and verified email for the dev user, and a Tenant then sees them", async () => {
    const tenantId = TenantId(randomUUID());
    await new PostgresTenancy(service).linkVerified(tenantId, DEV_SUBJECT);

    // The stack's database outlives a run, so a Person synchronized before is already current.
    expect(['recorded', 'unchanged']).toContain(await synchronize()(DEV_SUBJECT));

    const rows = await service.inTenant(tenantId, (s) =>
      s.query<{ display_name: string | null; email: string | null }>(
        `SELECT display_name, email FROM ${SCHEMA}.person WHERE subject = $1`,
        [DEV_SUBJECT],
      ),
    );
    expect(rows).toEqual([{ display_name: 'Local Developer', email: 'dev@orchestra.localhost' }]);
  });

  it('leaves a verified Person the realm does not know as it is', async () => {
    const subject = `unknown-${randomUUID()}`;
    await new PostgresTenancy(service).linkVerified(TenantId(randomUUID()), subject);
    expect(await synchronize()(subject)).toBe('unknown-to-identity-provider');
  });

  it('reads nothing with a client secret the realm does not hold', async () => {
    await expect(keycloak('not-the-secret').attributesOf(DEV_SUBJECT)).rejects.toBeInstanceOf(DependencyUnavailable);
  });
});
