// Tokens the identity provider issued (ADR-0017), in the two kinds this service meets: an end user's
// credential to resolve (credential-resolution.md CR3), and a calling service's own token (CR2). Keys
// come from the identity provider's published key set, and a key set that cannot be reached is
// DependencyUnavailable, never a failed verification (CR8).
import { createRemoteJWKSet, errors, type JWTPayload, jwtVerify, type JWTVerifyGetKey } from 'jose';
import { DependencyUnavailable } from '../../application/errors.ts';
import type {
  Caller,
  CallerAuthenticator,
  CredentialVerification,
  CredentialVerifier,
} from '../../application/ports.ts';

export interface TokenCheck {
  /** The exact issuer a token must carry. */
  readonly issuer: string;
  /** The audience a token must name. */
  readonly audience: string;
}

/** The identity provider's signing keys, fetched from its key set and cached between fetches. */
export function remoteSigningKeys(jwksUrl: string): JWTVerifyGetKey {
  return createRemoteJWKSet(new URL(jwksUrl), { timeoutDuration: 3_000, cooldownDuration: 30_000 });
}

// Fixed here rather than read from the token, so a token cannot choose a weaker algorithm, or none.
const ALGORITHMS = ['RS256'];

/**
 * A token's verified payload, or undefined when the token fails verification. Throws
 * DependencyUnavailable when the signing keys cannot be obtained, because then nothing was judged.
 */
export async function verifyToken(
  token: string,
  keys: JWTVerifyGetKey,
  check: TokenCheck,
): Promise<JWTPayload | undefined> {
  try {
    const { payload } = await jwtVerify(token, keys, {
      issuer: check.issuer,
      audience: check.audience,
      algorithms: ALGORITHMS,
      requiredClaims: ['exp', 'iat', 'sub'],
    });
    return payload;
  } catch (error) {
    if (keysUnavailable(error)) {
      throw new DependencyUnavailable('identity provider signing keys', { cause: error });
    }
    return undefined;
  }
}

// jose raises a specific error for every way a token itself fails. A timeout, a malformed key set,
// jose's generic error for a key set it could not fetch or parse, and any error that is not jose's
// all mean the keys were never obtained.
function keysUnavailable(error: unknown): boolean {
  if (error instanceof errors.JWKSTimeout || error instanceof errors.JWKSInvalid) return true;
  if (!(error instanceof errors.JOSEError)) return true;
  return error.code === 'ERR_JOSE_GENERIC';
}

/** The Organizations a credential names, whichever shape the identity provider gave the claim (CR4). */
export function organizationsNamed(claim: unknown): string[] {
  if (typeof claim === 'string') return [claim];
  if (Array.isArray(claim)) return claim.filter((alias): alias is string => typeof alias === 'string');
  if (claim !== null && typeof claim === 'object') return Object.keys(claim);
  return [];
}

export class IdentityProviderCredentialVerifier implements CredentialVerifier {
  readonly #keys: JWTVerifyGetKey;
  readonly #check: TokenCheck;

  constructor(keys: JWTVerifyGetKey, check: TokenCheck) {
    this.#keys = keys;
    this.#check = check;
  }

  async verify(credential: string): Promise<CredentialVerification> {
    const payload = await verifyToken(credential, this.#keys, this.#check);
    if (payload?.sub === undefined) return { outcome: 'rejected' };
    return {
      outcome: 'verified',
      claims: { subject: payload.sub, organizations: organizationsNamed(payload['organization']) },
    };
  }
}

export class IdentityProviderCallerAuthenticator implements CallerAuthenticator {
  readonly #keys: JWTVerifyGetKey;
  readonly #check: TokenCheck;

  constructor(keys: JWTVerifyGetKey, check: TokenCheck) {
    this.#keys = keys;
    this.#check = check;
  }

  /** A service token names the client it was issued to in `azp`, which is who is calling. */
  async authenticate(token: string): Promise<Caller | undefined> {
    const payload = await verifyToken(token, this.#keys, this.#check);
    const client = payload?.['azp'];
    return typeof client === 'string' && client.length > 0 ? { client } : undefined;
  }
}
