import { InvariantViolated } from './errors.ts';
import type { PrincipalId, TenantId, MembershipId } from './identifiers.ts';
import type { Membership } from './membership.ts';
import type { Person } from './person.ts';

/**
 * Any authenticated actor. Every action resolves to exactly one Principal, never to a Person
 * (domain model invariant I2). The Connector subtype joins only when ADR-0007 binds.
 */
export type Principal = PlatformUser | EndUser | ServiceAccount;

export interface PlatformUser {
  readonly kind: 'platform-user';
  readonly tenantId: TenantId;
  readonly id: PrincipalId;
  readonly membershipId: MembershipId;
}

export interface EndUser {
  readonly kind: 'end-user';
  readonly tenantId: TenantId;
  readonly id: PrincipalId;
  readonly membershipId: MembershipId;
}

export interface ServiceAccount {
  readonly kind: 'service-account';
  readonly tenantId: TenantId;
  readonly id: PrincipalId;
  readonly name: string;
}

// A person-backed Principal is built from its Membership and that Membership's Person, never from bare
// identifiers, so its Tenant is the Membership's by construction. There are no foreign keys
// (ADR-0023); this is one of the places a mismatched reference is refused.

/** A Platform User authenticates through the identity provider, so its Person must be a verified one. */
export function platformUserFor(membership: Membership, person: Person, id: PrincipalId): PlatformUser {
  requireSamePerson(membership, person);
  if (person.verification !== 'identity-provider') {
    throw new InvariantViolated('a Platform User needs a Person the identity provider verified');
  }
  return { kind: 'platform-user', tenantId: membership.tenantId, id, membershipId: membership.id };
}

export function endUserFor(membership: Membership, person: Person, id: PrincipalId): EndUser {
  requireSamePerson(membership, person);
  return { kind: 'end-user', tenantId: membership.tenantId, id, membershipId: membership.id };
}

export function createServiceAccount(tenantId: TenantId, id: PrincipalId, name: string): ServiceAccount {
  const trimmed = name.trim();
  if (trimmed.length === 0) throw new InvariantViolated('a Service Account needs a name');
  return { kind: 'service-account', tenantId, id, name: trimmed };
}

function requireSamePerson(membership: Membership, person: Person): void {
  if (membership.personId !== person.id) {
    throw new InvariantViolated('the Membership belongs to a different Person');
  }
}
