// In-memory adapters for the tenancy ports. They back the core's tests today and a local run
// without a database. Principals are stored per Tenant, so a lookup in one Tenant cannot see another
// Tenant's records — the same scoping row-level security gives the PostgreSQL adapter.
import type { TenantId } from '../../domain/identifiers.ts';
import type { PlatformUser } from '../../domain/principal.ts';
import type { PrincipalRepository, TenantDirectory, TenantDirectoryEntry } from '../../application/ports.ts';

export class InMemoryTenantDirectory implements TenantDirectory {
  readonly #byOrganization = new Map<string, TenantDirectoryEntry>();

  add(entry: TenantDirectoryEntry): void {
    this.#byOrganization.set(entry.identityProviderOrganization, entry);
  }

  async findByIdentityProviderOrganization(organization: string): Promise<TenantDirectoryEntry | undefined> {
    return this.#byOrganization.get(organization);
  }
}

export class InMemoryPrincipalRepository implements PrincipalRepository {
  readonly #byTenant = new Map<TenantId, Map<string, PlatformUser>>();

  add(principal: PlatformUser): void {
    const tenant = this.#byTenant.get(principal.tenantId) ?? new Map<string, PlatformUser>();
    tenant.set(principal.identityProviderSubject, principal);
    this.#byTenant.set(principal.tenantId, tenant);
  }

  async findPlatformUserBySubject(tenantId: TenantId, subject: string): Promise<PlatformUser | undefined> {
    return this.#byTenant.get(tenantId)?.get(subject);
  }
}
