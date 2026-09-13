// The inbound HTTP adapter. It serves health only: the resolution endpoint waits for its contract in
// docs/30-protocol, because services talk through versioned contracts (ADR-0020 rule B3), and an
// endpoint shipped before its contract becomes the contract by accident. What is decided already
// applies: every response is a JSON:API document, through ./json-api.ts (ADR-0025).
import { Hono } from 'hono';
import { type JsonApiEnv, type Log, install, resource, respond } from './json-api.ts';

export interface HttpDependencies {
  readonly log: Log;
}

export function createApp({ log }: HttpDependencies): Hono<JsonApiEnv> {
  const app = new Hono<JsonApiEnv>();
  install(app, log);
  resource(app, '/healthz', { get: { handle: (c) => respond(c, { meta: { status: 'ok' } }) } });
  return app;
}
