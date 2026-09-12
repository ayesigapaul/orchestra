// Ports: what the application needs from the outside world, stated in the domain's terms. Adapters
// implement them; the core never imports an adapter.
import type { TenantId } from '../domain/identifiers.ts';
import type { PlatformUser } from '../domain/principal.ts';

/**
 * One Tenant's routing facts, readable before any tenant context exists. The directory holds these
 * and nothing else (multi-tenancy.md section 7), which is why it is the one table exempt from
 * row-level security.
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

/** Every read names its Tenant, and an implementation must scope the query to it and nothing wider. */
export interface PrincipalRepository {
  findPlatformUserBySubject(tenantId: TenantId, subject: string): Promise<PlatformUser | undefined>;
}
