import { InvariantViolated } from './errors.ts';
import type { PersonId, TenantId } from './identifiers.ts';

/**
 * A human, recorded once across every Tenant they belong to (ADR-0024). A Tenant sees a Person only
 * through its own Membership, and a Person never acts: every action resolves to a Principal.
 */
export type Person = VerifiedPerson | AssertedPerson;

/** Keyed by the subject Orchestra's identity provider verified — the only kind that spans Tenants. */
export interface VerifiedPerson {
  readonly verification: 'identity-provider';
  readonly id: PersonId;
  readonly subject: string;
  readonly displayName: string | undefined;
  readonly email: string | undefined;
}

/**
 * An End User a customer's backend vouches for. Orchestra has verified nothing about them, so the
 * Person is keyed to the asserting Tenant, is never merged with another, and carries no global
 * attributes for any Tenant to set.
 */
export interface AssertedPerson {
  readonly verification: 'tenant-asserted';
  readonly id: PersonId;
  readonly subject: string;
  readonly assertingTenantId: TenantId;
}

export function verifiedPerson(id: PersonId, subject: string): VerifiedPerson {
  return {
    verification: 'identity-provider',
    id,
    subject: requireSubject(subject),
    displayName: undefined,
    email: undefined,
  };
}

export function assertedPerson(id: PersonId, assertingTenantId: TenantId, subject: string): AssertedPerson {
  return { verification: 'tenant-asserted', id, subject: requireSubject(subject), assertingTenantId };
}

export interface IdentityProviderAttributes {
  readonly displayName: string;
  readonly email?: string;
}

const EMAIL = /^[^@\s]+@[^@\s]+$/;

/**
 * Global attributes come only from the identity provider. The signature accepts a VerifiedPerson and
 * nothing else, so recording attributes on an asserted Person does not compile.
 */
export function recordIdentityProviderAttributes(
  person: VerifiedPerson,
  attributes: IdentityProviderAttributes,
): VerifiedPerson {
  const displayName = attributes.displayName.trim();
  if (displayName.length === 0) throw new InvariantViolated('a Person needs a display name');

  const email = attributes.email?.trim().toLowerCase();
  if (email !== undefined && !EMAIL.test(email)) {
    throw new InvariantViolated('a Person email must be an address');
  }

  return { ...person, displayName, email };
}

function requireSubject(subject: string): string {
  const trimmed = subject.trim();
  if (trimmed.length === 0) throw new InvariantViolated('a Person needs a subject');
  return trimmed;
}
