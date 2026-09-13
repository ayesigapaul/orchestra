import { createLocalJWKSet, errors, exportJWK, generateKeyPair, type JWTVerifyGetKey, SignJWT } from 'jose';
import { describe, expect, it } from 'vitest';
import {
  IdentityProviderCallerAuthenticator,
  IdentityProviderCredentialVerifier,
  organizationsNamed,
} from '../../../src/adapters/identity-provider/tokens.ts';
import { DependencyUnavailable } from '../../../src/application/errors.ts';

const ISSUER = 'http://idp.test/realms/orchestra';
const CREDENTIALS = { issuer: ISSUER, audience: 'orchestra-gateway' };
const SERVICES = { issuer: ISSUER, audience: 'tenant-user-management' };

const signing = await generateKeyPair('RS256');
const keys = createLocalJWKSet({
  keys: [{ ...(await exportJWK(signing.publicKey)), kid: 'current', alg: 'RS256', use: 'sig' }],
});

interface Minted {
  readonly claims?: Record<string, unknown>;
  readonly issuer?: string;
  readonly audience?: string;
  readonly expiresAt?: number;
  readonly key?: CryptoKey;
  readonly kid?: string;
}

const now = () => Math.floor(Date.now() / 1000);

function mint({ claims = {}, issuer = ISSUER, audience = 'orchestra-gateway', expiresAt, key, kid }: Minted = {}) {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'RS256', kid: kid ?? 'current' })
    .setIssuer(issuer)
    .setAudience(audience)
    .setSubject('kc-bea')
    .setIssuedAt(now() - 60)
    .setExpirationTime(expiresAt ?? now() + 300)
    .sign(key ?? signing.privateKey);
}

describe('IdentityProviderCredentialVerifier', () => {
  const verifier = new IdentityProviderCredentialVerifier(keys, CREDENTIALS);

  it.each([
    ['a single alias', 'local-tenant'],
    ['a list of aliases', ['local-tenant']],
    ['an object keyed by alias', { 'local-tenant': { id: '<organization-id>' } }],
  ])('verifies a credential whose organization claim is %s', async (_shape, organization) => {
    expect(await verifier.verify(await mint({ claims: { organization } }))).toEqual({
      outcome: 'verified',
      claims: { subject: 'kc-bea', organizations: ['local-tenant'] },
    });
  });

  it('verifies a credential with no organization claim, leaving resolution to reject it', async () => {
    expect(await verifier.verify(await mint())).toEqual({
      outcome: 'verified',
      claims: { subject: 'kc-bea', organizations: [] },
    });
  });

  it.each([
    ['from another issuer', () => mint({ issuer: 'http://elsewhere.test/realms/orchestra' })],
    ['for another audience', () => mint({ audience: 'another-client' })],
    ['that has expired', () => mint({ expiresAt: now() - 30 })],
    ['signed with a key the identity provider does not publish', async () => mint({ key: (await generateKeyPair('RS256')).privateKey })],
    ['naming a key the key set does not hold', () => mint({ kid: 'retired' })],
    ['that is not a token at all', async () => 'not-a-token'],
    ['whose segments do not decode', async () => 'a.b.c'],
  ])('rejects a credential %s', async (_why, credential) => {
    expect(await verifier.verify(await credential())).toEqual({ outcome: 'rejected' });
  });

  it('rejects an unsigned credential', async () => {
    const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
    const unsigned = `${encode({ alg: 'none' })}.${encode({ iss: ISSUER, aud: 'orchestra-gateway', sub: 'kc-bea', iat: now(), exp: now() + 300 })}.`;
    expect(await verifier.verify(unsigned)).toEqual({ outcome: 'rejected' });
  });

  it.each([
    ['the key set times out', new errors.JWKSTimeout()],
    ['the key set cannot be fetched', new TypeError('fetch failed')],
    ['the key set cannot be parsed', new errors.JOSEError('Failed to parse the JSON Web Key Set HTTP response as JSON')],
    ['the key set is malformed', new errors.JWKSInvalid('JSON Web Key Set malformed')],
  ])('throws DependencyUnavailable rather than rejecting when %s', async (_why, failure) => {
    const unreachable: JWTVerifyGetKey = async () => {
      throw failure;
    };
    const blind = new IdentityProviderCredentialVerifier(unreachable, CREDENTIALS);
    await expect(blind.verify(await mint())).rejects.toBeInstanceOf(DependencyUnavailable);
  });
});

describe('IdentityProviderCallerAuthenticator', () => {
  const authenticator = new IdentityProviderCallerAuthenticator(keys, SERVICES);

  it('names the client a service token was issued to', async () => {
    const token = await mint({ audience: 'tenant-user-management', claims: { azp: 'orchestra-gateway' } });
    expect(await authenticator.authenticate(token)).toEqual({ client: 'orchestra-gateway' });
  });

  it('refuses a token issued for another audience, such as an end user credential', async () => {
    const token = await mint({ audience: 'orchestra-gateway', claims: { azp: 'orchestra-cli' } });
    expect(await authenticator.authenticate(token)).toBeUndefined();
  });

  it('refuses a token that names no client', async () => {
    expect(await authenticator.authenticate(await mint({ audience: 'tenant-user-management' }))).toBeUndefined();
  });
});

describe('organizationsNamed', () => {
  it('ignores what is not an alias', () => {
    expect(organizationsNamed([42, 'a', null])).toEqual(['a']);
    expect(organizationsNamed(undefined)).toEqual([]);
    expect(organizationsNamed(7)).toEqual([]);
  });
});
