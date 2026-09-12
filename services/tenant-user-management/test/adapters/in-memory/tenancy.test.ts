// The properties ADR-0024 requires of any adapter, checked against the in-memory one. The same cases
// were run against PostgreSQL 18.6 when the ADR was written; the PostgreSQL adapter will run them too.
import { beforeEach, describe, expect, it } from 'vitest';
import { InMemoryTenancy } from '../../../src/adapters/in-memory/tenancy.ts';
import { TenantId } from '../../../src/domain/identifiers.ts';

const tenantA = TenantId('11111111-1111-4111-8111-111111111111');
const tenantB = TenantId('22222222-2222-4222-8222-222222222222');
const tenantC = TenantId('33333333-3333-4333-8333-333333333333');

describe('InMemoryTenancy', () => {
  let tenancy: InMemoryTenancy;
  beforeEach(() => {
    tenancy = new InMemoryTenancy();
  });

  it('shows a Tenant no Person until it holds a Membership', async () => {
    await tenancy.linkVerified(tenantA, 'kc-ada');
    expect(tenancy.personsVisibleTo(tenantA)).toHaveLength(1);
    expect(tenancy.personsVisibleTo(tenantB)).toHaveLength(0);
  });

  it('gives two Tenants that link the same verified subject one shared Person', async () => {
    const inA = await tenancy.linkVerified(tenantA, 'kc-ada');
    const inB = await tenancy.linkVerified(tenantB, 'kc-ada');
    expect(inA.personId).toBe(inB.personId);
    expect(inA.id).not.toBe(inB.id);
  });

  it('shows each Tenant only its own Memberships', async () => {
    await tenancy.linkVerified(tenantA, 'kc-ada');
    await tenancy.linkVerified(tenantB, 'kc-ada');
    expect(tenancy.membershipsVisibleTo(tenantA).map((m) => m.tenantId)).toEqual([tenantA]);
  });

  it('never merges an asserted End User across Tenants', async () => {
    const inA = await tenancy.linkAsserted(tenantA, 'customer-42');
    const inB = await tenancy.linkAsserted(tenantB, 'customer-42');
    expect(inA.personId).not.toBe(inB.personId);
    expect(tenancy.personsVisibleTo(tenantB).map((p) => p.id)).toEqual([inB.personId]);
  });

  it('does not let an asserted subject claim a verified Person', async () => {
    const verified = await tenancy.linkVerified(tenantA, 'kc-ada');
    const asserted = await tenancy.linkAsserted(tenantC, 'kc-ada');
    expect(asserted.personId).not.toBe(verified.personId);
  });

  it('shows every Tenant the identity provider’s attributes, and none a Tenant supplied', async () => {
    await tenancy.linkVerified(tenantA, 'kc-ada');
    tenancy.recordIdentityProviderAttributes('kc-ada', { displayName: 'Ada Lovelace', email: 'ada@example.com' });
    await tenancy.linkVerified(tenantB, 'kc-ada');
    expect(tenancy.personsVisibleTo(tenantB)).toEqual([
      expect.objectContaining({ displayName: 'Ada Lovelace', email: 'ada@example.com' }),
    ]);
  });

  it('is idempotent: linking twice keeps one Membership', async () => {
    const first = await tenancy.linkVerified(tenantA, 'kc-ada');
    const second = await tenancy.linkVerified(tenantA, 'kc-ada');
    expect(second.id).toBe(first.id);
  });
});
