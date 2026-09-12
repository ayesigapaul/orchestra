import type { PrincipalId, TenantId } from '../domain/identifiers.ts';
import type { PrincipalRepository, TenantDirectory } from './ports.ts';

/** What the Gateway knows after verifying a Platform User's credential, and nothing it could not verify. */
export interface VerifiedClaims {
  readonly subject: string;
  readonly organization: string | undefined;
}

export type Resolution =
  | { readonly outcome: 'resolved'; readonly tenantId: TenantId; readonly principalId: PrincipalId }
  | { readonly outcome: 'rejected'; readonly reason: RejectionReason };

/** For logs only. An adapter never returns it to a caller: a reason is an oracle. */
export type RejectionReason =
  | 'no-organization'
  | 'unknown-organization'
  | 'tenant-not-active'
  | 'unknown-principal'
  | 'tenant-mismatch';

/**
 * Resolves a verified credential to exactly one Principal and one Tenant, or rejects it
 * (ADR-0022). There is no partial answer: anything short of both is a rejection, and a failing
 * dependency throws rather than resolving, so the caller fails closed.
 */
export function resolvePrincipal(deps: { directory: TenantDirectory; principals: PrincipalRepository }) {
  return async (claims: VerifiedClaims): Promise<Resolution> => {
    if (claims.organization === undefined || claims.organization.trim().length === 0) {
      return rejected('no-organization');
    }

    const entry = await deps.directory.findByIdentityProviderOrganization(claims.organization);
    if (entry === undefined) return rejected('unknown-organization');
    if (entry.status !== 'active') return rejected('tenant-not-active');

    const principal = await deps.principals.findPlatformUserByVerifiedSubject(entry.tenantId, claims.subject);
    if (principal === undefined) return rejected('unknown-principal');
    if (principal.tenantId !== entry.tenantId) return rejected('tenant-mismatch');

    return { outcome: 'resolved', tenantId: entry.tenantId, principalId: principal.id };
  };
}

function rejected(reason: RejectionReason): Resolution {
  return { outcome: 'rejected', reason };
}
