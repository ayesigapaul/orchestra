import { describe, expect, it } from 'vitest';
import { InMemoryTenancy, InMemoryTenantDirectory } from '../../src/adapters/in-memory/tenancy.ts';
import { DependencyUnavailable } from '../../src/application/errors.ts';
import type { CredentialVerifier } from '../../src/application/ports.ts';
import { resolveCredential } from '../../src/application/resolve-credential.ts';
import { PrincipalId, TenantId } from '../../src/domain/identifiers.ts';

const tenantId = TenantId('11111111-1111-4111-8111-111111111111');
const principalId = PrincipalId('cccccccc-cccc-4ccc-8ccc-cccccccccccc');

async function resolverWith(verifier: CredentialVerifier) {
  const directory = new InMemoryTenantDirectory();
  const tenancy = new InMemoryTenancy();
  directory.add({ tenantId, status: 'active', identityProviderOrganization: 'org-a' });
  tenancy.addPlatformUser(await tenancy.linkVerified(tenantId, 'kc-bea'), principalId);
  return resolveCredential({ verifier, directory, principals: tenancy });
}

const verifies = (subject: string, organizations: string[]): CredentialVerifier => ({
  verify: async () => ({ outcome: 'verified', claims: { subject, organizations } }),
});

describe('resolveCredential', () => {
  it('resolves a credential the verifier accepts to its Principal and Tenant', async () => {
    const resolve = await resolverWith(verifies('kc-bea', ['org-a']));
    expect(await resolve('<credential>')).toEqual({ outcome: 'resolved', tenantId, principalId });
  });

  it('rejects a credential the verifier rejects', async () => {
    const resolve = await resolverWith({ verify: async () => ({ outcome: 'rejected' }) });
    expect(await resolve('<credential>')).toEqual({ outcome: 'rejected', reason: 'invalid-credential' });
  });

  it('rejects a verified credential that does not resolve, with the reason for the log', async () => {
    const resolve = await resolverWith(verifies('kc-somebody-else', ['org-a']));
    expect(await resolve('<credential>')).toEqual({ outcome: 'rejected', reason: 'unknown-principal' });
  });

  it('lets a verifier that cannot run throw, so the caller fails closed rather than rejecting', async () => {
    const resolve = await resolverWith({
      verify: async () => {
        throw new DependencyUnavailable('identity provider signing keys');
      },
    });
    await expect(resolve('<credential>')).rejects.toBeInstanceOf(DependencyUnavailable);
  });
});
