import type { CredentialVerifier, PrincipalRepository, TenantDirectory } from './ports.ts';
import { rejected, type Resolution, resolvePrincipal } from './resolve-principal.ts';

/**
 * Resolves a credential to exactly one Principal and one Tenant (credential-resolution.md). The
 * credential is verified here and never taken on a caller's word (CR3). A credential that fails
 * verification is a rejection. A verifier that cannot run throws, because the credential was never
 * judged (CR8), and either way nothing short of a resolution establishes a Principal (CR7).
 */
export function resolveCredential(deps: {
  verifier: CredentialVerifier;
  directory: TenantDirectory;
  principals: PrincipalRepository;
}) {
  const resolve = resolvePrincipal(deps);
  return async (credential: string): Promise<Resolution> => {
    const verification = await deps.verifier.verify(credential);
    if (verification.outcome === 'rejected') return rejected('invalid-credential');
    return resolve(verification.claims);
  };
}
