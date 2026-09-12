import { describe, expect, it } from 'vitest';
import { InvariantViolated } from '../../src/domain/errors.ts';
import { MembershipId, PersonId, TenantId } from '../../src/domain/identifiers.ts';
import { membershipFor } from '../../src/domain/membership.ts';
import { assertedPerson, verifiedPerson } from '../../src/domain/person.ts';

const tenantA = TenantId('11111111-1111-4111-8111-111111111111');
const tenantB = TenantId('22222222-2222-4222-8222-222222222222');
const personId = PersonId('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
const membershipId = MembershipId('dddddddd-dddd-4ddd-8ddd-dddddddddddd');

describe('Membership', () => {
  it('lets a verified Person join any Tenant', () => {
    const person = verifiedPerson(personId, 'kc-ada');
    expect(membershipFor(person, tenantA, membershipId).tenantId).toBe(tenantA);
    expect(membershipFor(person, tenantB, membershipId).tenantId).toBe(tenantB);
  });

  it('keeps an asserted Person in the Tenant that asserted it', () => {
    const person = assertedPerson(personId, tenantA, 'customer-42');
    expect(membershipFor(person, tenantA, membershipId).personId).toBe(personId);
    expect(() => membershipFor(person, tenantB, membershipId)).toThrow(InvariantViolated);
  });
});
