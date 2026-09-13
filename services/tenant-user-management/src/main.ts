// Composition root: the one place that reads configuration and wires adapters to the core.
import { serve } from '@hono/node-server';
import pino from 'pino';
import { z } from 'zod';
import { createApp } from './adapters/http/app.ts';

const config = z
  .object({ PORT: z.coerce.number().int().min(1).max(65535).default(8080) })
  .parse(process.env);

const log = pino({ name: 'tenant-user-management' });

const server = serve({ fetch: createApp({ log }).fetch, port: config.PORT }, (info) => {
  log.info({ port: info.port }, 'listening');
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
