// Composition root: the one place that reads configuration and wires adapters to the core.
import { serve } from '@hono/node-server';
import pino from 'pino';
import { z } from 'zod';
import { createApp } from './adapters/http/app.ts';
import { connect } from './adapters/postgres/database.ts';

const config = z
  .object({
    PORT: z.coerce.number().int().min(1).max(65535).default(8080),
    // The service's own role, through the pool (ADR-0021).
    DATABASE_URL: z.url(),
  })
  .parse(process.env);

const log = pino({ name: 'tenant-user-management' });
const database = connect(config.DATABASE_URL, {
  onIdleConnectionError: (error) => log.error({ err: error }, 'a pooled database connection failed while idle'),
});

const app = createApp({
  log,
  ready: () =>
    database.withoutTenant(async (statements) => {
      await statements.query('SELECT 1');
    }),
});

const server = serve({ fetch: app.fetch, port: config.PORT }, (info) => {
  log.info({ port: info.port }, 'listening');
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => server.close(() => void database.close().finally(() => process.exit(0))));
}
