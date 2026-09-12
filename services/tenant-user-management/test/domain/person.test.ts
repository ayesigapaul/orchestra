import { describe, expect, it } from 'vitest';
import { InvariantViolated } from '../../src/domain/errors.ts';
import { PersonId, TenantId } from '../../src/domain/identifiers.ts';
import { assertedPerson, recordIdentityProviderAttributes, verifiedPerson } from '../../src/domain/person.ts';

const id = PersonId('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
const tenantId = TenantId('11111111-1111-4111-8111-111111111111');

describe('Person', () => {
  it('starts with no attributes, because none may come from a Tenant', () => {
    const person = verifiedPerson(id, 'kc-ada');
    expect(person.displayName).toBeUndefined();
    expect(person.email).toBeUndefined();
  });

  it('takes a trimmed name and a normalised email from the identity provider', () => {
    const person = recordIdentityProviderAttributes(verifiedPerson(id, 'kc-ada'), {
      displayName: '  Ada Lovelace ',
      email: ' Ada@Example.COM ',
    });
    expect(person).toMatchObject({ displayName: 'Ada Lovelace', email: 'ada@example.com' });
  });

  it('refuses a blank name and an email that is not an address', () => {
    const person = verifiedPerson(id, 'kc-ada');
    expect(() => recordIdentityProviderAttributes(person, { displayName: '  ' })).toThrow(InvariantViolated);
    expect(() => recordIdentityProviderAttributes(person, { displayName: 'Ada', email: 'nope' })).toThrow(
      InvariantViolated,
    );
  });

  it('keys an asserted Person to the Tenant that asserted it', () => {
    expect(assertedPerson(id, tenantId, 'customer-42')).toMatchObject({
      verification: 'tenant-asserted',
      assertingTenantId: tenantId,
    });
  });

  it('refuses a blank subject of either kind', () => {
    expect(() => verifiedPerson(id, ' ')).toThrow(InvariantViolated);
    expect(() => assertedPerson(id, tenantId, '')).toThrow(InvariantViolated);
  });
});

describe('identifiers', () => {
  it('normalise case and refuse anything that is not a UUID', () => {
    expect(TenantId('11111111-1111-4111-8111-11111111111A')).toBe('11111111-1111-4111-8111-11111111111a');
    expect(() => TenantId('tenant-1')).toThrow();
  });
});
