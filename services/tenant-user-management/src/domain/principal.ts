import { InvariantViolated } from './errors.ts';
import type { PersonId, PrincipalId, TenantId } from './identifiers.ts';
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
  readonly personId: PersonId;
  /** The subject the tenant's identity provider asserts for this person. */
  readonly identityProviderSubject: string;
}

export interface EndUser {
  readonly kind: 'end-user';
  readonly tenantId: TenantId;
  readonly id: PrincipalId;
  readonly personId: PersonId;
  /** The subject the customer's backend asserts when it asks for a Session Token. */
  readonly externalSubject: string;
}

export interface ServiceAccount {
  readonly kind: 'service-account';
  readonly tenantId: TenantId;
  readonly id: PrincipalId;
  readonly name: string;
}

// A person-backed Principal is built from the Person itself, never from a bare PersonId, so its
// Tenant is the Person's by construction. There are no foreign keys (ADR-0023); this is one of the
// two places a cross-tenant reference is refused, the other being the table's write policy.

export function platformUserFor(person: Person, id: PrincipalId, subject: string): PlatformUser {
  return {
    kind: 'platform-user',
    tenantId: person.tenantId,
    id,
    personId: person.id,
    identityProviderSubject: requireSubject(subject),
  };
}

export function endUserFor(person: Person, id: PrincipalId, subject: string): EndUser {
  return {
    kind: 'end-user',
    tenantId: person.tenantId,
    id,
    personId: person.id,
    externalSubject: requireSubject(subject),
  };
}

export function createServiceAccount(tenantId: TenantId, id: PrincipalId, name: string): ServiceAccount {
  const trimmed = name.trim();
  if (trimmed.length === 0) throw new InvariantViolated('a Service Account needs a name');
  return { kind: 'service-account', tenantId, id, name: trimmed };
}

function requireSubject(subject: string): string {
  const trimmed = subject.trim();
  if (trimmed.length === 0) throw new InvariantViolated('a Principal needs a subject');
  return trimmed;
}
