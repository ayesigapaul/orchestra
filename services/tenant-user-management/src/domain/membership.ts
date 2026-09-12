import { InvariantViolated } from './errors.ts';
import type { MembershipId, PersonId, TenantId } from './identifiers.ts';
import type { Person } from './person.ts';

/**
 * A Person's place in one Tenant (ADR-0024). Memberships are tenant-scoped: a Tenant sees its own and
 * never learns which other Tenants a Person belongs to.
 */
export interface Membership {
  readonly tenantId: TenantId;
  readonly id: MembershipId;
  readonly personId: PersonId;
}

export function membershipFor(person: Person, tenantId: TenantId, id: MembershipId): Membership {
  if (person.verification === 'tenant-asserted' && person.assertingTenantId !== tenantId) {
    throw new InvariantViolated('an asserted Person belongs only to the Tenant that asserted it');
  }
  return { tenantId, id, personId: person.id };
}
