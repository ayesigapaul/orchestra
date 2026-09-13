import type { PrincipalId, TenantId } from '../domain/identifiers.ts';
import type { PrincipalRepository, TenantDirectory, VerifiedClaims } from './ports.ts';

export type Resolution =
  | { readonly outcome: 'resolved'; readonly tenantId: TenantId; readonly principalId: PrincipalId }
  | { readonly outcome: 'rejected'; readonly reason: RejectionReason };

/** For logs only. An adapter never returns it to a caller: a reason is an oracle. */
export type RejectionReason =
  | 'invalid-credential'
  | 'no-organization'
  | 'ambiguous-organization'
  | 'unknown-organization'
  | 'tenant-not-active'
  | 'unknown-principal'
  | 'tenant-mismatch';

/**
 * Resolves verified claims to exactly one Principal and one Tenant, or rejects them
 * (credential-resolution.md CR4 and CR5). There is no partial answer: anything short of both is a
 * rejection, and a failing dependency throws rather than resolving, so the caller fails closed.
 */
export function resolvePrincipal(deps: { directory: TenantDirectory; principals: PrincipalRepository }) {
  return async (claims: VerifiedClaims): Promise<Resolution> => {
    const organizations = [...new Set(claims.organizations.map((o) => o.trim()).filter((o) => o.length > 0))];
    const [organization] = organizations;
    if (organization === undefined) return rejected('no-organization');
    if (organizations.length > 1) return rejected('ambiguous-organization');

    const entry = await deps.directory.findByIdentityProviderOrganization(organization);
    if (entry === undefined) return rejected('unknown-organization');
    if (entry.status !== 'active') return rejected('tenant-not-active');

    const principal = await deps.principals.findPlatformUserByVerifiedSubject(entry.tenantId, claims.subject);
    if (principal === undefined) return rejected('unknown-principal');
    if (principal.tenantId !== entry.tenantId) return rejected('tenant-mismatch');

    return { outcome: 'resolved', tenantId: entry.tenantId, principalId: principal.id };
  };
}

export function rejected(reason: RejectionReason): Resolution {
  return { outcome: 'rejected', reason };
}
