import { describe, expect, it, vi } from 'vitest';
import { InMemoryTenancy } from '../../src/adapters/in-memory/tenancy.ts';
import { DependencyUnavailable } from '../../src/application/errors.ts';
import type { IdentityProviderUsers } from '../../src/application/ports.ts';
import { synchronizeIdentities, synchronizeIdentity } from '../../src/application/synchronize-identity.ts';
import { TenantId } from '../../src/domain/identifiers.ts';
import type { IdentityProviderAttributes } from '../../src/domain/person.ts';

const tenantA = TenantId('11111111-1111-4111-8111-111111111111');
const tenantB = TenantId('22222222-2222-4222-8222-222222222222');

const holding = (users: Record<string, IdentityProviderAttributes>): IdentityProviderUsers => ({
  attributesOf: async (subject) => users[subject],
});

const ADA = { displayName: 'Ada Lovelace', email: 'ada@example.com' };

describe('synchronizeIdentity', () => {
  it("records the identity provider's name and email on a verified Person, for every Tenant to see", async () => {
    const tenancy = new InMemoryTenancy();
    await tenancy.linkVerified(tenantA, 'kc-ada');
    await tenancy.linkVerified(tenantB, 'kc-ada');

    const synchronize = synchronizeIdentity({ persons: tenancy, identityProvider: holding({ 'kc-ada': ADA }) });
    expect(await synchronize('kc-ada')).toBe('recorded');

    for (const tenant of [tenantA, tenantB]) {
      expect(tenancy.personsVisibleTo(tenant)).toEqual([expect.objectContaining(ADA)]);
    }
  });

  it('writes nothing when the Person already carries what the identity provider holds', async () => {
    const tenancy = new InMemoryTenancy();
    await tenancy.linkVerified(tenantA, 'kc-ada');
    const identityProvider = holding({ 'kc-ada': ADA });
    await synchronizeIdentity({ persons: tenancy, identityProvider })('kc-ada');

    const record = vi.spyOn(tenancy, 'recordAttributes');
    expect(await synchronizeIdentity({ persons: tenancy, identityProvider })('kc-ada')).toBe('unchanged');
    expect(record).not.toHaveBeenCalled();
  });

  it('clears an email the identity provider no longer holds as verified', async () => {
    const tenancy = new InMemoryTenancy();
    await tenancy.linkVerified(tenantA, 'kc-ada');
    await synchronizeIdentity({ persons: tenancy, identityProvider: holding({ 'kc-ada': ADA }) })('kc-ada');

    const withoutEmail = holding({ 'kc-ada': { displayName: 'Ada Lovelace' } });
    expect(await synchronizeIdentity({ persons: tenancy, identityProvider: withoutEmail })('kc-ada')).toBe('recorded');
    expect(tenancy.personsVisibleTo(tenantA)).toEqual([expect.objectContaining({ email: undefined })]);
  });

  it('finds no verified Person for an asserted subject, and so gives it nothing', async () => {
    const tenancy = new InMemoryTenancy();
    await tenancy.linkAsserted(tenantA, 'customer-7');
    const identityProvider = holding({ 'customer-7': ADA });

    expect(await synchronizeIdentity({ persons: tenancy, identityProvider })('customer-7')).toBe('unknown-person');
    expect(tenancy.personsVisibleTo(tenantA)).toEqual([expect.not.objectContaining({ displayName: 'Ada Lovelace' })]);
  });

  it('leaves a Person as it is when the identity provider no longer knows the subject', async () => {
    const tenancy = new InMemoryTenancy();
    await tenancy.linkVerified(tenantA, 'kc-ada');
    await synchronizeIdentity({ persons: tenancy, identityProvider: holding({ 'kc-ada': ADA }) })('kc-ada');

    expect(await synchronizeIdentity({ persons: tenancy, identityProvider: holding({}) })('kc-ada')).toBe(
      'unknown-to-identity-provider',
    );
    expect(tenancy.personsVisibleTo(tenantA)).toEqual([expect.objectContaining(ADA)]);
  });

  it('records nothing the domain refuses', async () => {
    const tenancy = new InMemoryTenancy();
    await tenancy.linkVerified(tenantA, 'kc-ada');
    const blank = holding({ 'kc-ada': { displayName: '   ', email: 'ada@example.com' } });

    expect(await synchronizeIdentity({ persons: tenancy, identityProvider: blank })('kc-ada')).toBe('invalid-attributes');
    expect(tenancy.personsVisibleTo(tenantA)).toEqual([expect.objectContaining({ displayName: undefined })]);
  });

  it('lets an unreachable identity provider throw, and records nothing', async () => {
    const tenancy = new InMemoryTenancy();
    await tenancy.linkVerified(tenantA, 'kc-ada');
    const unreachable: IdentityProviderUsers = {
      attributesOf: async () => {
        throw new DependencyUnavailable('identity provider admin API');
      },
    };

    await expect(synchronizeIdentity({ persons: tenancy, identityProvider: unreachable })('kc-ada')).rejects.toBeInstanceOf(
      DependencyUnavailable,
    );
    expect(tenancy.personsVisibleTo(tenantA)).toEqual([expect.objectContaining({ displayName: undefined })]);
  });
});

describe('synchronizeIdentities', () => {
  it('synchronizes every verified Person, and counts what happened', async () => {
    const tenancy = new InMemoryTenancy();
    await tenancy.linkVerified(tenantA, 'kc-ada');
    await tenancy.linkVerified(tenantA, 'kc-bea');
    await tenancy.linkVerified(tenantB, 'kc-gone');
    await tenancy.linkAsserted(tenantB, 'customer-7');
    const identityProvider = holding({ 'kc-ada': ADA, 'kc-bea': { displayName: 'Bea' } });

    expect(await synchronizeIdentities({ persons: tenancy, identityProvider })()).toEqual({
      recorded: 2,
      unchanged: 0,
      'unknown-person': 0,
      'unknown-to-identity-provider': 1,
      'invalid-attributes': 0,
    });
  });
});
