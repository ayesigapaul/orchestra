// Composition root: the one place that reads configuration and wires adapters to the core.
import { serve } from '@hono/node-server';
import pino from 'pino';
import { z } from 'zod';
import { createApp } from './adapters/http/app.ts';
import {
  IdentityProviderCallerAuthenticator,
  IdentityProviderCredentialVerifier,
  remoteSigningKeys,
} from './adapters/identity-provider/tokens.ts';
import { connect } from './adapters/postgres/database.ts';
import { PostgresTenancy, PostgresTenantDirectory } from './adapters/postgres/tenancy.ts';
import { resolveCredential } from './application/resolve-credential.ts';

const config = z
  .object({
    PORT: z.coerce.number().int().min(1).max(65535).default(8080),
    // The service's own role, through the pool (ADR-0021).
    DATABASE_URL: z.url(),
    // The issuer tokens carry, which is where clients reach the identity provider, and the key set
    // as this service reaches it. The two hosts can differ, as they do in the local stack.
    IDENTITY_PROVIDER_ISSUER: z.url(),
    IDENTITY_PROVIDER_JWKS_URL: z.url(),
    // The audience of a credential to resolve: the Gateway's, to which clients present it.
    CREDENTIAL_AUDIENCE: z.string().min(1),
    // The audience of a calling service's own token: this service (HC17).
    SERVICE_AUDIENCE: z.string().min(1).default('tenant-user-management'),
    // The clients that may resolve credentials, comma-separated (credential-resolution.md CR2).
    RESOLUTION_CALLERS: z
      .string()
      .default('orchestra-gateway')
      .transform((value) => value.split(',').map((client) => client.trim()).filter((client) => client !== '')),
  })
  .parse(process.env);

const log = pino({ name: 'tenant-user-management' });
const database = connect(config.DATABASE_URL, {
  onIdleConnectionError: (error) => log.error({ err: error }, 'a pooled database connection failed while idle'),
});

// Both kinds of token are signed with the identity provider's keys, so one cached key set serves both.
const keys = remoteSigningKeys(config.IDENTITY_PROVIDER_JWKS_URL);
const issuer = config.IDENTITY_PROVIDER_ISSUER;

const app = createApp({
  log,
  ready: () =>
    database.withoutTenant(async (statements) => {
      await statements.query('SELECT 1');
    }),
  credentialResolution: {
    callers: new IdentityProviderCallerAuthenticator(keys, { issuer, audience: config.SERVICE_AUDIENCE }),
    allowedCallers: config.RESOLUTION_CALLERS,
    resolve: resolveCredential({
      verifier: new IdentityProviderCredentialVerifier(keys, { issuer, audience: config.CREDENTIAL_AUDIENCE }),
      directory: new PostgresTenantDirectory(database),
      principals: new PostgresTenancy(database),
    }),
  },
});

const server = serve({ fetch: app.fetch, port: config.PORT }, (info) => {
  log.info({ port: info.port }, 'listening');
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => server.close(() => void database.close().finally(() => process.exit(0))));
}
