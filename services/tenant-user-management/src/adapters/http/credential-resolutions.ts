// POST /credential-resolutions (docs/30-protocol/credential-resolution.md). The caller authenticates
// as itself before its body is read, then the credential in the body is resolved. Every rejection is
// an answer that says nothing about why (CR6): the reason goes to the log with the request
// identifier, and the credential itself goes nowhere (CR3).
import type { Hono } from 'hono';
import { z } from 'zod';
import { DependencyUnavailable } from '../../application/errors.ts';
import type { CallerAuthenticator } from '../../application/ports.ts';
import type { Resolution } from '../../application/resolve-principal.ts';
import { ApiError, codes, type JsonApiEnv, type Log, readDocument, resource, respond } from './json-api.ts';

export interface CredentialResolutionDependencies {
  readonly callers: CallerAuthenticator;
  /** The identity provider clients that may resolve credentials. Today, only the Gateway's (CR2). */
  readonly allowedCallers: readonly string[];
  readonly resolve: (credential: string) => Promise<Resolution>;
}

const TYPE = 'credential-resolutions';

// Each message becomes an error's detail, so none repeats the value it refuses (HC11).
const ResolutionRequest = z.object({
  data: z.object({
    type: z.literal(TYPE, { error: `type must be ${TYPE}` }),
    attributes: z.object(
      {
        credential: z
          .string({ error: 'credential must be a string' })
          .min(1, { error: 'credential must not be empty' }),
      },
      { error: 'attributes must be an object carrying credential' },
    ),
  }),
});

export function credentialResolutions(
  app: Hono<JsonApiEnv>,
  log: Log,
  deps: CredentialResolutionDependencies,
): void {
  resource(app, '/credential-resolutions', {
    post: {
      // A resolution is computed and never stored (CR1), so even a fault leaves nothing behind.
      changesNothing: true,
      handle: async (c) => {
        const requestId = c.get('requestId');
        await authorizeCaller(c.req.header('authorization'), deps, log, requestId);
        const { data } = await readDocument(c, ResolutionRequest);

        const resolution = await unlessUnavailable(log, requestId, () =>
          deps.resolve(data.attributes.credential),
        );
        if (resolution.outcome === 'rejected') {
          log.warn({ requestId, reason: resolution.reason }, 'credential not resolved');
          return respond(c, { data: { type: TYPE, id: requestId, attributes: { outcome: 'rejected' } } });
        }
        return respond(c, {
          data: {
            type: TYPE,
            id: requestId,
            attributes: {
              outcome: 'resolved',
              tenant_id: resolution.tenantId,
              principal_id: resolution.principalId,
              principal_kind: 'platform-user',
            },
          },
        });
      },
    },
  });
}

async function authorizeCaller(
  authorization: string | undefined,
  deps: CredentialResolutionDependencies,
  log: Log,
  requestId: string,
): Promise<void> {
  const token = /^bearer +(\S+) *$/i.exec(authorization ?? '')?.[1];
  if (token === undefined) {
    throw new ApiError(codes.unauthenticated, {}, { 'WWW-Authenticate': 'Bearer' });
  }
  const caller = await unlessUnavailable(log, requestId, () => deps.callers.authenticate(token));
  if (caller === undefined) {
    throw new ApiError(codes.unauthenticated, {}, { 'WWW-Authenticate': 'Bearer error="invalid_token"' });
  }
  if (!deps.allowedCallers.includes(caller.client)) {
    log.warn({ requestId, caller: caller.client }, 'caller may not resolve credentials');
    throw new ApiError(codes.forbidden);
  }
}

// A dependency that could not be reached decided nothing: 503, safe to retry (CR8), cause logged.
async function unlessUnavailable<T>(log: Log, requestId: string, work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    if (!(error instanceof DependencyUnavailable)) throw error;
    log.error({ err: error, requestId }, `${error.dependency} unavailable`);
    throw new ApiError(codes.upstreamUnavailable);
  }
}
