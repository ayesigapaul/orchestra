// A user as Keycloak holds it (ADR-0017), read from its admin API as this service's own client. That
// client holds view-users and nothing else, so reading is all it can do there. The mapping is the one
// identity-and-access.md section 2 gives: a name from the first and last name, or the username when
// neither is set, and an email only once Keycloak has verified it.
import { DependencyUnavailable } from '../../application/errors.ts';
import type { IdentityProviderUsers } from '../../application/ports.ts';
import type { IdentityProviderAttributes } from '../../domain/person.ts';

export interface KeycloakUsersOptions {
  /** Where this service reaches Keycloak, such as http://keycloak:8080. */
  readonly baseUrl: string;
  readonly realm: string;
  readonly clientId: string;
  readonly clientSecret: string;
  readonly fetch?: typeof fetch;
  readonly now?: () => number;
  readonly timeoutMs?: number;
}

/** The parts of Keycloak's user representation the mapping reads. Anything else is ignored. */
export interface KeycloakUser {
  readonly username?: unknown;
  readonly firstName?: unknown;
  readonly lastName?: unknown;
  readonly email?: unknown;
  readonly emailVerified?: unknown;
}

// A token is replaced this long before it expires, so it is never presented as it lapses.
const RENEW_BEFORE_EXPIRY_MS = 30_000;
const DEPENDENCY = 'identity provider admin API';

export class KeycloakUsers implements IdentityProviderUsers {
  readonly #realmUrl: string;
  readonly #adminUrl: string;
  readonly #credentials: string;
  readonly #fetch: typeof fetch;
  readonly #now: () => number;
  readonly #timeoutMs: number;
  #token: { readonly value: string; readonly renewAt: number } | undefined;

  constructor(options: KeycloakUsersOptions) {
    const base = options.baseUrl.replace(/\/+$/, '');
    const realm = encodeURIComponent(options.realm);
    this.#realmUrl = `${base}/realms/${realm}`;
    this.#adminUrl = `${base}/admin/realms/${realm}`;
    // RFC 6749 section 2.3.1: each part is form-encoded before the pair is base64-encoded.
    const pair = `${encodeURIComponent(options.clientId)}:${encodeURIComponent(options.clientSecret)}`;
    this.#credentials = Buffer.from(pair).toString('base64');
    this.#fetch = options.fetch ?? fetch;
    this.#now = options.now ?? Date.now;
    this.#timeoutMs = options.timeoutMs ?? 3_000;
  }

  async attributesOf(subject: string): Promise<IdentityProviderAttributes | undefined> {
    const url = `${this.#adminUrl}/users/${encodeURIComponent(subject)}`;
    let response = await this.#getUser(url);
    if (response.status === 401) {
      // The token was refused, perhaps because it lapsed early: another one, once.
      this.#token = undefined;
      response = await this.#getUser(url);
    }
    if (response.status === 404) return undefined;
    if (response.status !== 200) {
      throw new DependencyUnavailable(DEPENDENCY, { cause: new Error(`answered ${response.status}`) });
    }
    return attributesFrom(await this.#json<KeycloakUser>(response));
  }

  async #getUser(url: string): Promise<Response> {
    return this.#request(url, { headers: { Authorization: `Bearer ${await this.#bearer()}` } });
  }

  async #bearer(): Promise<string> {
    if (this.#token !== undefined && this.#now() < this.#token.renewAt) return this.#token.value;
    const requestedAt = this.#now();
    const response = await this.#request(`${this.#realmUrl}/protocol/openid-connect/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${this.#credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ grant_type: 'client_credentials' }),
    });
    if (response.status !== 200) {
      throw new DependencyUnavailable(DEPENDENCY, { cause: new Error(`token endpoint answered ${response.status}`) });
    }
    const body = await this.#json<{ access_token?: unknown; expires_in?: unknown }>(response);
    if (typeof body.access_token !== 'string' || body.access_token === '' || typeof body.expires_in !== 'number') {
      throw new DependencyUnavailable(DEPENDENCY, { cause: new Error('token endpoint answered without a token') });
    }
    const renewAt = requestedAt + Math.max(0, body.expires_in * 1_000 - RENEW_BEFORE_EXPIRY_MS);
    this.#token = { value: body.access_token, renewAt };
    return body.access_token;
  }

  // A request that cannot complete, or does not complete in time, means Keycloak was not reached.
  async #request(url: string, init: RequestInit): Promise<Response> {
    try {
      return await this.#fetch(url, { ...init, signal: AbortSignal.timeout(this.#timeoutMs) });
    } catch (error) {
      throw new DependencyUnavailable(DEPENDENCY, { cause: error });
    }
  }

  async #json<T>(response: Response): Promise<T> {
    try {
      return (await response.json()) as T;
    } catch (error) {
      throw new DependencyUnavailable(DEPENDENCY, { cause: error });
    }
  }
}

/** The attributes a Keycloak user gives a Person. An unverified email is not one of them. */
export function attributesFrom(user: KeycloakUser): IdentityProviderAttributes {
  const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
  const name = [text(user.firstName), text(user.lastName)].filter((part) => part !== '').join(' ');
  const email = user.emailVerified === true ? text(user.email) : '';
  return { displayName: name || text(user.username), ...(email === '' ? {} : { email }) };
}
