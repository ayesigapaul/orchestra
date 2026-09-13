// The inbound HTTP adapter: health, and credential resolution for the Gateway, whose contract is
// docs/30-protocol/credential-resolution.md. Every operation is in the service's OpenAPI document
// before it ships (HC14), and every response is a JSON:API document, through ./json-api.ts
// (ADR-0025).
import { Hono } from 'hono';
import {
  type CredentialResolutionDependencies,
  credentialResolutions,
} from './credential-resolutions.ts';
import { ApiError, codes, install, type JsonApiEnv, type Log, resource, respond } from './json-api.ts';
import { traceRequests } from './trace-context.ts';

export interface HttpDependencies {
  readonly log: Log;
  /** Resolves when the service can serve, and rejects when a dependency it needs cannot be reached. */
  readonly ready: () => Promise<void>;
  readonly credentialResolution: CredentialResolutionDependencies;
}

export function createApp({ log, ready, credentialResolution }: HttpDependencies): Hono<JsonApiEnv> {
  const app = new Hono<JsonApiEnv>();
  // First, so every request is served and logged in a span of its own, refusals included.
  app.use(traceRequests(log));
  install(app, log);
  resource(app, '/healthz', {
    get: {
      handle: async (c) => {
        try {
          await ready();
        } catch (error) {
          // Why is for the log; the caller learns only that the service is not ready (HC11).
          log.error({ err: error, requestId: c.get('requestId') }, 'not ready');
          throw new ApiError(codes.unavailable);
        }
        return respond(c, { meta: { status: 'ok' } });
      },
    },
  });
  credentialResolutions(app, log, credentialResolution);
  return app;
}
