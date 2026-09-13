import { beforeEach, describe, expect, it } from 'vitest';
import { InMemoryTenancy, InMemoryTenantDirectory } from '../../src/adapters/in-memory/tenancy.ts';
import { resolvePrincipal } from '../../src/application/resolve-principal.ts';
import { PrincipalId, TenantId } from '../../src/domain/identifiers.ts';

const tenantA = TenantId('11111111-1111-4111-8111-111111111111');
const tenantB = TenantId('22222222-2222-4222-8222-222222222222');
const beaInB = PrincipalId('cccccccc-cccc-4ccc-8ccc-cccccccccccc');

describe('resolvePrincipal', () => {
  let directory: InMemoryTenantDirectory;
  let tenancy: InMemoryTenancy;
  let resolve: ReturnType<typeof resolvePrincipal>;

  beforeEach(async () => {
    directory = new InMemoryTenantDirectory();
    tenancy = new InMemoryTenancy();
    resolve = resolvePrincipal({ directory, principals: tenancy });

    directory.add({ tenantId: tenantA, status: 'active', identityProviderOrganization: 'org-a' });
    directory.add({ tenantId: tenantB, status: 'active', identityProviderOrganization: 'org-b' });
    tenancy.addPlatformUser(await tenancy.linkVerified(tenantB, 'kc-bea'), beaInB);
  });

  it('resolves a verified subject in an active Tenant to exactly one Principal and one Tenant', async () => {
    expect(await resolve({ subject: 'kc-bea', organizations: ['org-b'] })).toEqual({
      outcome: 'resolved',
      tenantId: tenantB,
      principalId: beaInB,
    });
  });

  it('does not resolve a subject with no Membership in the credential’s Tenant', async () => {
    expect(await resolve({ subject: 'kc-bea', organizations: ['org-a'] })).toEqual({
      outcome: 'rejected',
      reason: 'unknown-principal',
    });
  });

  it('resolves one Person in two Tenants to a different Principal in each', async () => {
    const beaInA = PrincipalId('dddddddd-dddd-4ddd-8ddd-dddddddddddd');
    tenancy.addPlatformUser(await tenancy.linkVerified(tenantA, 'kc-bea'), beaInA);
    expect(await resolve({ subject: 'kc-bea', organizations: ['org-a'] })).toMatchObject({ principalId: beaInA });
    expect(await resolve({ subject: 'kc-bea', organizations: ['org-b'] })).toMatchObject({ principalId: beaInB });
  });

  it('rejects a credential that names no organization, or one the directory does not know', async () => {
    expect(await resolve({ subject: 'kc-bea', organizations: [] })).toEqual({
      outcome: 'rejected',
      reason: 'no-organization',
    });
    expect(await resolve({ subject: 'kc-bea', organizations: ['org-z'] })).toEqual({
      outcome: 'rejected',
      reason: 'unknown-organization',
    });
  });

  it('rejects a credential that names more than one organization, since the Tenant would be a guess', async () => {
    expect(await resolve({ subject: 'kc-bea', organizations: ['org-a', 'org-b'] })).toEqual({
      outcome: 'rejected',
      reason: 'ambiguous-organization',
    });
  });

  it('treats one organization named twice as one', async () => {
    expect(await resolve({ subject: 'kc-bea', organizations: ['org-b', ' org-b '] })).toMatchObject({
      outcome: 'resolved',
    });
  });

  it('rejects a suspended Tenant even for a known subject', async () => {
    directory.add({ tenantId: tenantB, status: 'suspended', identityProviderOrganization: 'org-b' });
    expect(await resolve({ subject: 'kc-bea', organizations: ['org-b'] })).toEqual({
      outcome: 'rejected',
      reason: 'tenant-not-active',
    });
  });

  it('lets a failing dependency throw rather than resolve, so the caller fails closed', async () => {
    const failing = resolvePrincipal({
      directory: { findByIdentityProviderOrganization: async () => Promise.reject(new Error('database down')) },
      principals: tenancy,
    });
    await expect(failing({ subject: 'kc-bea', organizations: ['org-b'] })).rejects.toThrow('database down');
  });
});
