import { describe, expect, it } from 'vitest';
import { InvariantViolated } from '../../src/domain/errors.ts';
import { PersonId, TenantId } from '../../src/domain/identifiers.ts';
import { createPerson } from '../../src/domain/person.ts';

const tenantId = TenantId('11111111-1111-4111-8111-111111111111');
const id = PersonId('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');

describe('Person', () => {
  it('holds a trimmed display name and a normalised email', () => {
    const person = createPerson({ tenantId, id, displayName: '  Ada Lovelace ', email: ' Ada@Example.COM ' });
    expect(person).toEqual({ tenantId, id, displayName: 'Ada Lovelace', email: 'ada@example.com' });
  });

  it('may have no email', () => {
    expect(createPerson({ tenantId, id, displayName: 'Ada' }).email).toBeUndefined();
  });

  it('refuses a blank display name', () => {
    expect(() => createPerson({ tenantId, id, displayName: '   ' })).toThrow(InvariantViolated);
  });

  it('refuses an email that is not an address', () => {
    expect(() => createPerson({ tenantId, id, displayName: 'Ada', email: 'not-an-address' })).toThrow(
      InvariantViolated,
    );
  });
});

describe('identifiers', () => {
  it('normalise case and refuse anything that is not a UUID', () => {
    expect(TenantId('11111111-1111-4111-8111-11111111111A')).toBe('11111111-1111-4111-8111-11111111111a');
    expect(() => TenantId('tenant-1')).toThrow();
  });
});
