import { beforeEach, describe, expect, it } from 'vitest';
import { InMemoryPrincipalRepository, InMemoryTenantDirectory } from '../../src/adapters/in-memory/tenancy.ts';
import { resolvePrincipal } from '../../src/application/resolve-principal.ts';
import { PersonId, PrincipalId, TenantId } from '../../src/domain/identifiers.ts';
import { createPerson } from '../../src/domain/person.ts';
import { platformUserFor } from '../../src/domain/principal.ts';

const tenantA = TenantId('11111111-1111-4111-8111-111111111111');
const tenantB = TenantId('22222222-2222-4222-8222-222222222222');

describe('resolvePrincipal', () => {
  let directory: InMemoryTenantDirectory;
  let principals: InMemoryPrincipalRepository;
  let resolve: ReturnType<typeof resolvePrincipal>;

  beforeEach(() => {
    directory = new InMemoryTenantDirectory();
    principals = new InMemoryPrincipalRepository();
    resolve = resolvePrincipal({ directory, principals });

    directory.add({ tenantId: tenantA, status: 'active', identityProviderOrganization: 'org-a' });
    directory.add({ tenantId: tenantB, status: 'active', identityProviderOrganization: 'org-b' });

    const inB = createPerson({ tenantId: tenantB, id: PersonId('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'), displayName: 'Bea' });
    principals.add(platformUserFor(inB, PrincipalId('cccccccc-cccc-4ccc-8ccc-cccccccccccc'), 'subject-only-in-b'));
  });

  it('resolves a known subject in an active Tenant to exactly one Principal and one Tenant', async () => {
    expect(await resolve({ subject: 'subject-only-in-b', organization: 'org-b' })).toEqual({
      outcome: 'resolved',
      tenantId: tenantB,
      principalId: PrincipalId('cccccccc-cccc-4ccc-8ccc-cccccccccccc'),
    });
  });

  it('does not resolve a subject that exists only in another Tenant', async () => {
    expect(await resolve({ subject: 'subject-only-in-b', organization: 'org-a' })).toEqual({
      outcome: 'rejected',
      reason: 'unknown-principal',
    });
  });

  it('rejects a credential that names no organization', async () => {
    expect(await resolve({ subject: 'subject-only-in-b', organization: undefined })).toMatchObject({ outcome: 'rejected' });
  });

  it('rejects an organization the directory does not know', async () => {
    expect(await resolve({ subject: 'subject-only-in-b', organization: 'org-z' })).toMatchObject({ outcome: 'rejected' });
  });

  it('rejects a suspended Tenant even for a known subject', async () => {
    directory.add({ tenantId: tenantB, status: 'suspended', identityProviderOrganization: 'org-b' });
    expect(await resolve({ subject: 'subject-only-in-b', organization: 'org-b' })).toEqual({
      outcome: 'rejected',
      reason: 'tenant-not-active',
    });
  });

  it('lets a failing dependency throw rather than resolve, so the caller fails closed', async () => {
    const failing = resolvePrincipal({
      directory: { findByIdentityProviderOrganization: async () => Promise.reject(new Error('database down')) },
      principals,
    });
    await expect(failing({ subject: 'subject-only-in-b', organization: 'org-b' })).rejects.toThrow('database down');
  });
});
