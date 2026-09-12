import { describe, expect, it } from 'vitest';
import { InvariantViolated } from '../../src/domain/errors.ts';
import { MembershipId, PersonId, PrincipalId, TenantId } from '../../src/domain/identifiers.ts';
import { membershipFor } from '../../src/domain/membership.ts';
import { assertedPerson, verifiedPerson } from '../../src/domain/person.ts';
import { createServiceAccount, endUserFor, platformUserFor } from '../../src/domain/principal.ts';

const tenantId = TenantId('11111111-1111-4111-8111-111111111111');
const principalId = PrincipalId('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
const ada = verifiedPerson(PersonId('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), 'kc-ada');
const adaInTenant = membershipFor(ada, tenantId, MembershipId('dddddddd-dddd-4ddd-8ddd-dddddddddddd'));

describe('Principal', () => {
  it('takes a Platform User’s Tenant from its Membership', () => {
    const user = platformUserFor(adaInTenant, ada, principalId);
    expect(user).toMatchObject({ tenantId, membershipId: adaInTenant.id });
  });

  it('refuses a Platform User whose Person is only asserted', () => {
    const asserted = assertedPerson(PersonId('cccccccc-cccc-4ccc-8ccc-cccccccccccc'), tenantId, 'customer-42');
    const membership = membershipFor(asserted, tenantId, MembershipId('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'));
    expect(() => platformUserFor(membership, asserted, principalId)).toThrow(InvariantViolated);
    expect(endUserFor(membership, asserted, principalId).kind).toBe('end-user');
  });

  it('refuses a Membership that belongs to a different Person', () => {
    const other = verifiedPerson(PersonId('ffffffff-ffff-4fff-8fff-ffffffffffff'), 'kc-bea');
    expect(() => platformUserFor(adaInTenant, other, principalId)).toThrow(InvariantViolated);
  });

  it('gives a Service Account no Membership and no Person', () => {
    const account = createServiceAccount(tenantId, principalId, 'billing backend');
    expect(account).not.toHaveProperty('membershipId');
  });
});
