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

  it('takes a trimmed name, and an email whose domain alone is lowercased', () => {
    const person = recordIdentityProviderAttributes(verifiedPerson(id, 'kc-ada'), {
      displayName: '  Ada Lovelace ',
      email: ' Ada.Lovelace@Example.COM ',
    });
    // RFC 5321 section 2.4: the case of the local part is the receiving server's to interpret.
    expect(person).toMatchObject({ displayName: 'Ada Lovelace', email: 'Ada.Lovelace@example.com' });
  });

  it('stores a name in Unicode NFC, however the identity provider composed it', () => {
    const decomposed = 'Zoë Nguyễn';
    const person = recordIdentityProviderAttributes(verifiedPerson(id, 'kc-zoe'), { displayName: decomposed });
    expect(person.displayName).toBe('Zoë Nguyễn');
  });

  it('keeps a name in the order and script the identity provider gave it', () => {
    const person = recordIdentityProviderAttributes(verifiedPerson(id, 'kc-taro'), { displayName: '山田 太郎' });
    expect(person.displayName).toBe('山田 太郎');
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
