// The inbound HTTP adapter. It serves health only: the resolution endpoint waits for its contract in
// docs/30-protocol, because services talk through versioned contracts (ADR-0020 rule B3), and an
// endpoint shipped before its contract becomes the contract by accident.
import { Hono } from 'hono';

export function createApp(): Hono {
  const app = new Hono();
  app.get('/healthz', (c) => c.json({ status: 'ok' }));
  return app;
}
