// Ports: what the application needs from the outside world, stated in the domain's terms. Adapters
// implement them; the core never imports an adapter.
import type { TenantId } from '../domain/identifiers.ts';
import type { Membership } from '../domain/membership.ts';
import type { IdentityProviderAttributes, VerifiedPerson } from '../domain/person.ts';
import type { PlatformUser } from '../domain/principal.ts';

/**
 * One Tenant's routing facts, readable before any tenant context exists. The directory holds these
 * and nothing else (multi-tenancy.md section 7), which is why it is exempt from row-level security.
 */
export interface TenantDirectoryEntry {
  readonly tenantId: TenantId;
  readonly status: 'active' | 'suspended';
  /** The identity provider organization the Tenant maps to (ADR-0017). */
  readonly identityProviderOrganization: string;
}

export interface TenantDirectory {
  findByIdentityProviderOrganization(organization: string): Promise<TenantDirectoryEntry | undefined>;
}

/**
 * Creates or reuses a Person and gives one Tenant a Membership for it, and nothing more (ADR-0024).
 * There is no way to attach an existing Person by identifier: a verified subject joins a Person
 * across Tenants, and an asserted subject never leaves the Tenant that asserted it.
 */
export interface PersonLinker {
  linkVerified(tenantId: TenantId, verifiedSubject: string): Promise<Membership>;
  linkAsserted(tenantId: TenantId, assertedSubject: string): Promise<Membership>;
}

/** Every read names its Tenant, and an implementation must scope the query to it and nothing wider. */
export interface PrincipalRepository {
  findPlatformUserByVerifiedSubject(tenantId: TenantId, subject: string): Promise<PlatformUser | undefined>;
}

/** What a verified credential establishes about its holder, and nothing the verifier could not check. */
export interface VerifiedClaims {
  readonly subject: string;
  /** Every identity provider Organization the credential names. Resolution needs exactly one. */
  readonly organizations: readonly string[];
}

export type CredentialVerification =
  | { readonly outcome: 'verified'; readonly claims: VerifiedClaims }
  | { readonly outcome: 'rejected' };

/**
 * Verifies a credential against the identity provider's signing keys (credential-resolution.md CR3).
 * A credential that fails verification is rejected. When the keys cannot be reached, the verifier
 * throws DependencyUnavailable instead, because the credential was never judged (CR8).
 */
export interface CredentialVerifier {
  verify(credential: string): Promise<CredentialVerification>;
}

/** A service that called this one, established from its own verified token (http-conventions HC17). */
export interface Caller {
  /** The identity provider client the calling service authenticated as. */
  readonly client: string;
}

/**
 * Authenticates the calling service from its own token. A token that fails verification yields no
 * Caller. When the signing keys cannot be reached, it throws DependencyUnavailable.
 */
export interface CallerAuthenticator {
  authenticate(token: string): Promise<Caller | undefined>;
}

/**
 * What the identity provider holds about a user, read when a Person's attributes are synchronized
 * (ADR-0017, ADR-0024). Undefined means the identity provider no longer knows the subject. When it
 * cannot be reached, this throws DependencyUnavailable, so nothing is taken from it.
 */
export interface IdentityProviderUsers {
  attributesOf(subject: string): Promise<IdentityProviderAttributes | undefined>;
}

/**
 * Verified Persons as the identity-sync role reaches them: in every Tenant, and no other kind of
 * Person. It records a Person's name and email and changes nothing else (ADR-0024).
 */
export interface VerifiedPersons {
  findBySubject(subject: string): Promise<VerifiedPerson | undefined>;
  /** The subject of every verified Person. */
  subjects(): Promise<readonly string[]>;
  /** Records the name and email a Person carries, as recordIdentityProviderAttributes produced them. */
  recordAttributes(person: VerifiedPerson): Promise<void>;
}
