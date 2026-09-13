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
    subject: parseSubject(subject),
    displayName: undefined,
    email: undefined,
  };
}

export function assertedPerson(id: PersonId, assertingTenantId: TenantId, subject: string): AssertedPerson {
  return { verification: 'tenant-asserted', id, subject: parseSubject(subject), assertingTenantId };
}

/**
 * A subject in the form the domain stores it: trimmed, and never empty. Every adapter looks a Person
 * up by this form, so two spellings of one subject cannot become two Persons.
 */
export function parseSubject(subject: string): string {
  const trimmed = subject.trim();
  if (trimmed.length === 0) throw new InvariantViolated('a Person needs a subject');
  return trimmed;
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
  // Unicode NFC, the form the W3C character model asks of text in interchange, so one name is stored
  // one way however the identity provider composed its characters. Its order and script are kept.
  const displayName = attributes.displayName.normalize('NFC').trim();
  if (displayName.length === 0) throw new InvariantViolated('a Person needs a display name');

  const email = attributes.email === undefined ? undefined : normalizeEmail(attributes.email);
  if (email !== undefined && !EMAIL.test(email)) {
    throw new InvariantViolated('a Person email must be an address');
  }

  return { ...person, displayName, email };
}

/**
 * An email address with only its domain lowercased, because a domain name is case-insensitive
 * (RFC 4343). The local part is kept exactly as given: RFC 5321 section 2.4 leaves its case to the
 * receiving server, so lowercasing it could name another mailbox.
 */
function normalizeEmail(address: string): string {
  const trimmed = address.trim();
  const at = trimmed.lastIndexOf('@');
  if (at <= 0) return trimmed;
  return `${trimmed.slice(0, at)}@${trimmed.slice(at + 1).toLowerCase()}`;
}
