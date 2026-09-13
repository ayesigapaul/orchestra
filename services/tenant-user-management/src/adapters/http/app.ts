// The inbound HTTP adapter. It serves health only: the resolution endpoint waits for its contract in
// docs/30-protocol, because services talk through versioned contracts (ADR-0020 rule B3), and an
// endpoint shipped before its contract becomes the contract by accident. What is decided already
// applies: every response is a JSON:API document, through ./json-api.ts (ADR-0025).
import { Hono } from 'hono';
import { ApiError, codes, install, type JsonApiEnv, type Log, resource, respond } from './json-api.ts';

export interface HttpDependencies {
  readonly log: Log;
  /** Resolves when the service can serve, and rejects when a dependency it needs cannot be reached. */
  readonly ready: () => Promise<void>;
}

export function createApp({ log, ready }: HttpDependencies): Hono<JsonApiEnv> {
  const app = new Hono<JsonApiEnv>();
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
  return app;
}
