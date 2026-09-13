import { inspect } from 'node:util';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../../../src/adapters/http/app.ts';
import { InMemoryTenancy, InMemoryTenantDirectory } from '../../../src/adapters/in-memory/tenancy.ts';
import { DependencyUnavailable } from '../../../src/application/errors.ts';
import type {
  CallerAuthenticator,
  CredentialVerification,
  CredentialVerifier,
  PrincipalRepository,
  VerifiedClaims,
} from '../../../src/application/ports.ts';
import { resolveCredential } from '../../../src/application/resolve-credential.ts';
import { PrincipalId, TenantId } from '../../../src/domain/identifiers.ts';
import { expectDocumented, expectErrorDocument } from './contract.ts';

const PATH = '/credential-resolutions';
const JSON_API = 'application/vnd.api+json';
const tenantId = TenantId('11111111-1111-4111-8111-111111111111');
const principalId = PrincipalId('cccccccc-cccc-4ccc-8ccc-cccccccccccc');

// What the identity provider would have verified: each caller token names a client, and each
// credential carries claims. Every credential starts with "secret-", so a test can prove none leaks.
const CLIENTS = new Map([
  ['gateway-token', 'orchestra-gateway'],
  ['cli-token', 'orchestra-cli'],
]);
const CLAIMS = new Map<string, VerifiedClaims>([
  ['secret-bea', { subject: 'kc-bea', organizations: ['org-a'] }],
  ['secret-stranger', { subject: 'kc-stranger', organizations: ['org-a'] }],
]);

const unreachable = async (): Promise<never> => {
  throw new DependencyUnavailable('identity provider signing keys');
};

interface Setup {
  readonly callers?: CallerAuthenticator;
  readonly verifier?: CredentialVerifier;
  readonly principals?: PrincipalRepository;
}

interface Call {
  readonly caller?: string;
  readonly body?: unknown;
  readonly raw?: string;
  readonly headers?: Record<string, string>;
}

const resolution = (credential: unknown, type = 'credential-resolutions') => ({
  data: { type, attributes: { credential } },
});

async function serve(setup: Setup = {}) {
  const log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  const directory = new InMemoryTenantDirectory();
  const tenancy = new InMemoryTenancy();
  directory.add({ tenantId, status: 'active', identityProviderOrganization: 'org-a' });
  tenancy.addPlatformUser(await tenancy.linkVerified(tenantId, 'kc-bea'), principalId);

  const callers = setup.callers ?? {
    authenticate: async (token: string) => {
      const client = CLIENTS.get(token);
      return client === undefined ? undefined : { client };
    },
  };
  const verifier = setup.verifier ?? {
    verify: async (credential: string): Promise<CredentialVerification> => {
      const claims = CLAIMS.get(credential);
      return claims === undefined ? { outcome: 'rejected' } : { outcome: 'verified', claims };
    },
  };
  const app = createApp({
    log,
    ready: async () => {},
    credentialResolution: {
      callers,
      allowedCallers: ['orchestra-gateway'],
      resolve: resolveCredential({ verifier, directory, principals: setup.principals ?? tenancy }),
    },
  });

  const call = ({ caller, body = resolution('secret-bea'), raw, headers = {} }: Call = {}) =>
    app.request(PATH, {
      method: 'POST',
      headers: {
        'Content-Type': JSON_API,
        ...(caller === undefined ? {} : { Authorization: `Bearer ${caller}` }),
        ...headers,
      },
      body: raw ?? JSON.stringify(body),
    });
  return { app, log, call };
}

describe('POST /credential-resolutions', () => {
  it('resolves a credential to one Principal in one Tenant, identified by the request', async () => {
    const { call } = await serve();
    const res = await call({ caller: 'gateway-token' });
    expect(res.status).toBe(200);
    const body = await expectDocumented(res, PATH, 'POST');
    expect(body.data).toEqual({
      type: 'credential-resolutions',
      id: res.headers.get('Orchestra-Request-Id'),
      attributes: {
        outcome: 'resolved',
        tenant_id: tenantId,
        principal_id: principalId,
        principal_kind: 'platform-user',
      },
    });
  });

  it('answers every rejection alike, whatever its reason, and logs the reason instead', async () => {
    const { call, log } = await serve();
    for (const credential of ['secret-forged', 'secret-stranger']) {
      const res = await call({ caller: 'gateway-token', body: resolution(credential) });
      expect(res.status).toBe(200);
      const body = await expectDocumented(res, PATH, 'POST');
      expect(body.data).toEqual({
        type: 'credential-resolutions',
        id: res.headers.get('Orchestra-Request-Id'),
        attributes: { outcome: 'rejected' },
      });
    }
    const reasons = log.warn.mock.calls.map(([details]) => details.reason);
    expect(reasons).toEqual(['invalid-credential', 'unknown-principal']);
  });

  it('never logs or echoes a credential, on any path', async () => {
    const answers: string[] = [];
    const logged: unknown[] = [];
    for (const setup of [{}, { verifier: { verify: unreachable } }]) {
      const { call, log } = await serve(setup);
      const bodies = [resolution('secret-bea'), resolution('secret-forged'), resolution('secret-bea', 'wrong')];
      for (const body of bodies) {
        answers.push(await (await call({ caller: 'gateway-token', body })).text());
      }
      logged.push(log.warn.mock.calls, log.error.mock.calls);
    }
    expect(answers.join('\n')).not.toContain('secret-');
    expect(inspect(logged, { depth: 10 })).not.toContain('secret-');
  });

  it('refuses a caller with no token before it reads the body', async () => {
    const { call } = await serve();
    const res = await call({ raw: '{"data":' });
    expect(res.status).toBe(401);
    expect(res.headers.get('www-authenticate')).toBe('Bearer');
    const body = await expectDocumented(res, PATH, 'POST');
    expect(body.errors?.[0]).toMatchObject({ code: 'auth.unauthenticated', meta: { retry: 'unsafe' } });
  });

  it('refuses a caller whose token does not verify, without saying why', async () => {
    const { call } = await serve();
    const res = await call({ caller: 'expired-token' });
    expect(res.status).toBe(401);
    expect(res.headers.get('www-authenticate')).toBe('Bearer error="invalid_token"');
    const body = await expectDocumented(res, PATH, 'POST');
    expect(body.errors).toEqual([
      {
        id: res.headers.get('Orchestra-Request-Id'),
        status: '401',
        code: 'auth.unauthenticated',
        title: 'A valid credential is required',
        meta: { retry: 'unsafe' },
      },
    ]);
  });

  it('refuses a verified caller that may not resolve credentials, and logs which it was', async () => {
    const { call, log } = await serve();
    const res = await call({ caller: 'cli-token' });
    expect(res.status).toBe(403);
    const body = await expectDocumented(res, PATH, 'POST');
    expect(body.errors?.[0]).toMatchObject({ code: 'auth.forbidden', meta: { retry: 'unsafe' } });
    expect(log.warn).toHaveBeenCalledWith(expect.objectContaining({ caller: 'orchestra-cli' }), expect.any(String));
  });

  it.each([
    ['is not JSON', '{"data":'],
    ['is empty', ''],
    ['is not a JSON:API document', '{"credential":"secret-bea"}'],
    ['has no resource object in data', '{"data":[]}'],
  ])('answers 400 when the body %s', async (_why, raw) => {
    const { call } = await serve();
    const res = await call({ caller: 'gateway-token', raw });
    expect(res.status).toBe(400);
    const body = await expectDocumented(res, PATH, 'POST');
    expect(body.errors?.[0]).toMatchObject({ code: 'request.malformed', meta: { retry: 'unsafe' } });
  });

  it.each([
    ['missing', { data: { type: 'credential-resolutions', attributes: {} } }],
    ['not a string', resolution(42)],
    ['empty', resolution('')],
  ])('answers 422 naming the credential when it is %s', async (_why, body) => {
    const { call } = await serve();
    const res = await call({ caller: 'gateway-token', body });
    expect(res.status).toBe(422);
    const document = await expectDocumented(res, PATH, 'POST');
    expect(document.errors).toEqual([
      expect.objectContaining({
        code: 'request.validation_failed',
        source: { pointer: '/data/attributes/credential' },
        meta: { retry: 'unsafe' },
      }),
    ]);
  });

  it('answers each invalid member with its own error', async () => {
    const { call } = await serve();
    const res = await call({ caller: 'gateway-token', body: { data: { type: 'resolutions' } } });
    expect(res.status).toBe(422);
    const document = await expectDocumented(res, PATH, 'POST');
    expect(document.errors?.map((error) => [error.code, error.source?.pointer])).toEqual([
      ['request.validation_failed', '/data/type'],
      ['request.validation_failed', '/data/attributes'],
    ]);
  });

  it.each<[string, Setup]>([
    ['authenticate the caller', { callers: { authenticate: unreachable } }],
    ['verify the credential', { verifier: { verify: unreachable } }],
  ])('answers 503, safe to retry, when the keys to %s cannot be reached', async (_what, setup) => {
    const { call, log } = await serve(setup);
    const res = await call({ caller: 'gateway-token' });
    expect(res.status).toBe(503);
    const body = await expectDocumented(res, PATH, 'POST');
    expect(body.errors?.[0]).toMatchObject({ code: 'upstream.unavailable', meta: { retry: 'safe' } });
    expect(log.error).toHaveBeenCalledOnce();
  });

  it('answers a fault as safe to retry, because a resolution changes nothing', async () => {
    const principals = {
      findPlatformUserByVerifiedSubject: async (): Promise<never> => {
        throw new Error('connection to db.internal:5432 refused');
      },
    };
    const { call, log } = await serve({ principals });
    const res = await call({ caller: 'gateway-token' });
    expect(res.status).toBe(500);
    expect(await res.clone().text()).not.toContain('db.internal');
    const body = await expectDocumented(res, PATH, 'POST');
    expect(body.errors?.[0]).toMatchObject({ code: 'server.internal', meta: { retry: 'safe' } });
    expect(log.error).toHaveBeenCalledOnce();
  });

  it('accepts POST alone', async () => {
    const { app } = await serve();
    const res = await app.request(PATH);
    expect(res.status).toBe(405);
    expect(res.headers.get('allow')).toBe('POST');
    expect((await expectErrorDocument(res)).errors?.[0]?.code).toBe('request.method_not_allowed');
  });

  it.each<[number, string, Record<string, string>]>([
    [406, 'request.not_acceptable', { Accept: `${JSON_API}; charset=utf-8` }],
    [415, 'request.unsupported_media_type', { 'Content-Type': 'application/json', 'Content-Length': '64' }],
  ])('answers %i %s as its operation documents', async (status, code, headers) => {
    const { call } = await serve();
    const res = await call({ caller: 'gateway-token', headers });
    expect(res.status).toBe(status);
    expect((await expectDocumented(res, PATH, 'POST')).errors?.[0]?.code).toBe(code);
  });
});
