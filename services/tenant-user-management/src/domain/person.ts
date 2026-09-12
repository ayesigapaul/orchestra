import { InvariantViolated } from './errors.ts';
import type { PersonId, TenantId } from './identifiers.ts';

/**
 * A human known to one Tenant, and the single record of that human's attributes within it
 * (ADR-0022). Nothing else in Orchestra stores a name or an email; it holds a Principal identifier
 * and asks this service. The same human in two Tenants is two Persons.
 */
export interface Person {
  readonly tenantId: TenantId;
  readonly id: PersonId;
  readonly displayName: string;
  readonly email: string | undefined;
}

export interface NewPerson {
  readonly tenantId: TenantId;
  readonly id: PersonId;
  readonly displayName: string;
  readonly email?: string;
}

const EMAIL = /^[^@\s]+@[^@\s]+$/;

export function createPerson(input: NewPerson): Person {
  const displayName = input.displayName.trim();
  if (displayName.length === 0) throw new InvariantViolated('a Person needs a display name');

  const email = input.email?.trim().toLowerCase();
  if (email !== undefined && !EMAIL.test(email)) {
    throw new InvariantViolated('a Person email must be an address');
  }

  return { tenantId: input.tenantId, id: input.id, displayName, email };
}
