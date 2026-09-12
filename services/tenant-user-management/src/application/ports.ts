// Ports: what the application needs from the outside world, stated in the domain's terms. Adapters
// implement them; the core never imports an adapter.
import type { TenantId } from '../domain/identifiers.ts';
import type { Membership } from '../domain/membership.ts';
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
