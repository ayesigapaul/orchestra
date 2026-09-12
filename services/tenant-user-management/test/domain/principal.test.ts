import { describe, expect, it } from 'vitest';
import { InvariantViolated } from '../../src/domain/errors.ts';
import { PersonId, PrincipalId, TenantId } from '../../src/domain/identifiers.ts';
import { createPerson } from '../../src/domain/person.ts';
import { createServiceAccount, endUserFor, platformUserFor } from '../../src/domain/principal.ts';

const tenantId = TenantId('11111111-1111-4111-8111-111111111111');
const person = createPerson({ tenantId, id: PersonId('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), displayName: 'Ada' });
const principalId = PrincipalId('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');

describe('Principal', () => {
  it('takes a Platform User’s Tenant from its Person, so the two cannot disagree', () => {
    const user = platformUserFor(person, principalId, 'keycloak-subject');
    expect(user.tenantId).toBe(person.tenantId);
    expect(user.personId).toBe(person.id);
  });

  it('takes an End User’s Tenant from its Person too', () => {
    expect(endUserFor(person, principalId, 'customer-subject').tenantId).toBe(person.tenantId);
  });

  it('refuses a blank subject', () => {
    expect(() => platformUserFor(person, principalId, '  ')).toThrow(InvariantViolated);
  });

  it('gives a Service Account no Person', () => {
    const account = createServiceAccount(tenantId, principalId, 'billing backend');
    expect(account).not.toHaveProperty('personId');
  });
});
