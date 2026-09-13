import { describe, expect, it } from 'vitest';
import { attributesFrom, KeycloakUsers } from '../../../src/adapters/identity-provider/keycloak-users.ts';
import { DependencyUnavailable } from '../../../src/application/errors.ts';

const BASE = 'http://keycloak.test';
const TOKEN_URL = `${BASE}/realms/orchestra/protocol/openid-connect/token`;
const USERS_URL = `${BASE}/admin/realms/orchestra/users/`;

const DEV = {
  id: 'kc-dev',
  username: 'dev',
  firstName: 'Local',
  lastName: 'Developer',
  email: 'dev@orchestra.localhost',
  emailVerified: true,
};

type Answer = Response | (() => Response) | Error;

/** Keycloak's token endpoint and admin API, answering user requests from a script. */
function keycloak(userAnswers: Answer[], tokenAnswer: () => Response = () => Response.json({ access_token: 'unused', expires_in: 300 })) {
  const tokenRequests: Request[] = [];
  const userRequests: Request[] = [];
  const fetchStub: typeof fetch = async (input, init) => {
    const request = new Request(input, init);
    if (request.url === TOKEN_URL) {
      tokenRequests.push(request);
      const answer = tokenAnswer();
      if (answer.status !== 200) return answer;
      return Response.json({ access_token: `token-${tokenRequests.length}`, expires_in: 300 });
    }
    expect(request.url.startsWith(USERS_URL)).toBe(true);
    userRequests.push(request);
    const answer = userAnswers.shift();
    if (answer === undefined) throw new Error('no scripted answer left');
    if (answer instanceof Error) throw answer;
    return typeof answer === 'function' ? answer() : answer;
  };
  return { fetchStub, tokenRequests, userRequests };
}

function users(fetchStub: typeof fetch, now: () => number = () => 1_000_000) {
  return new KeycloakUsers({
    baseUrl: `${BASE}/`,
    realm: 'orchestra',
    clientId: 'tenant-user-management',
    clientSecret: 'secret-under-test',
    fetch: fetchStub,
    now,
  });
}

describe('KeycloakUsers', () => {
  it("reads a user as this service's own client, and maps the name and verified email", async () => {
    const { fetchStub, tokenRequests, userRequests } = keycloak([Response.json(DEV)]);

    expect(await users(fetchStub).attributesOf('kc-dev')).toEqual({
      displayName: 'Local Developer',
      email: 'dev@orchestra.localhost',
    });

    const [token] = tokenRequests;
    expect(token?.method).toBe('POST');
    expect(token?.headers.get('authorization')).toBe(
      `Basic ${Buffer.from('tenant-user-management:secret-under-test').toString('base64')}`,
    );
    expect(await token?.text()).toBe('grant_type=client_credentials');
    const [user] = userRequests;
    expect(user?.url).toBe(`${USERS_URL}kc-dev`);
    expect(user?.headers.get('authorization')).toBe('Bearer token-1');
  });

  it('answers undefined for a subject Keycloak does not know', async () => {
    const { fetchStub } = keycloak([new Response(null, { status: 404 })]);
    expect(await users(fetchStub).attributesOf('kc-nobody')).toBeUndefined();
  });

  it('puts the subject in the path encoded, so it cannot name another resource', async () => {
    const { fetchStub, userRequests } = keycloak([new Response(null, { status: 404 })]);
    await users(fetchStub).attributesOf('../groups');
    expect(userRequests[0]?.url).toBe(`${USERS_URL}..%2Fgroups`);
  });

  it('reuses its token until the token nears expiry', async () => {
    let now = 1_000_000;
    const { fetchStub, tokenRequests } = keycloak([Response.json(DEV), Response.json(DEV), Response.json(DEV)]);
    const reader = users(fetchStub, () => now);

    await reader.attributesOf('kc-dev');
    now += 269_000;
    await reader.attributesOf('kc-dev');
    expect(tokenRequests).toHaveLength(1);

    now += 2_000;
    await reader.attributesOf('kc-dev');
    expect(tokenRequests).toHaveLength(2);
  });

  it('obtains another token once when the admin API refuses one', async () => {
    const { fetchStub, tokenRequests, userRequests } = keycloak([new Response(null, { status: 401 }), Response.json(DEV)]);

    expect(await users(fetchStub).attributesOf('kc-dev')).toEqual(expect.objectContaining({ displayName: 'Local Developer' }));
    expect(tokenRequests).toHaveLength(2);
    expect(userRequests.map((request) => request.headers.get('authorization'))).toEqual(['Bearer token-1', 'Bearer token-2']);
  });

  it.each<[string, Answer[], (() => Response) | undefined]>([
    ['the admin API fails', [new Response(null, { status: 500 })], undefined],
    ['the admin API refuses a fresh token too', [new Response(null, { status: 401 }), new Response(null, { status: 401 })], undefined],
    ['the admin API is unreachable', [new TypeError('fetch failed')], undefined],
    ['the admin API answers what is not JSON', [new Response('<html>', { status: 200 })], undefined],
    ['the token endpoint refuses this client', [Response.json(DEV)], () => new Response(null, { status: 401 })],
  ])('is unavailable, never empty, when %s', async (_why, answers, tokenAnswer) => {
    const { fetchStub } = keycloak(answers, tokenAnswer);
    await expect(users(fetchStub).attributesOf('kc-dev')).rejects.toBeInstanceOf(DependencyUnavailable);
  });
});

describe('attributesFrom', () => {
  it('takes the name from the first and last name, and falls back to the username', () => {
    expect(attributesFrom({ ...DEV, lastName: undefined })).toEqual(expect.objectContaining({ displayName: 'Local' }));
    expect(attributesFrom({ ...DEV, firstName: ' ', lastName: null })).toEqual(expect.objectContaining({ displayName: 'dev' }));
  });

  it('never gives a Person an email Keycloak has not verified', () => {
    expect(attributesFrom({ ...DEV, emailVerified: false })).toEqual({ displayName: 'Local Developer' });
    expect(attributesFrom({ ...DEV, emailVerified: 'true' })).toEqual({ displayName: 'Local Developer' });
  });
});
