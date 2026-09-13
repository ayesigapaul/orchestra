// Composition root for identity sync: records the name and email the identity provider holds on every
// verified Person, then exits (ADR-0024). It connects as the identity-sync role, which can do nothing
// else, and reads Keycloak as this service's own client, which can only read users. When and how often
// it runs is not decided yet (docs/10-architecture/identity-and-access.md section 12).
import pino from 'pino';
import { z } from 'zod';
import { KeycloakUsers } from './adapters/identity-provider/keycloak-users.ts';
import { connect } from './adapters/postgres/database.ts';
import { PostgresVerifiedPersons } from './adapters/postgres/verified-persons.ts';
import { synchronizeIdentities } from './application/synchronize-identity.ts';

const config = z
  .object({
    // The identity-sync role, through the pool (ADR-0021).
    IDENTITY_SYNC_DATABASE_URL: z.url(),
    // Where this service reaches Keycloak, and the realm its users live in.
    IDENTITY_PROVIDER_URL: z.url(),
    IDENTITY_PROVIDER_REALM: z.string().min(1),
    // This service's own client, which holds view-users and nothing else.
    IDENTITY_SYNC_CLIENT_ID: z.string().min(1),
    IDENTITY_SYNC_CLIENT_SECRET: z.string().min(1),
  })
  .parse(process.env);

const log = pino({ name: 'tenant-user-management-identity-sync' });
const database = connect(config.IDENTITY_SYNC_DATABASE_URL, {
  max: 1,
  onIdleConnectionError: (error) => log.error({ err: error }, 'a pooled database connection failed while idle'),
});

try {
  const counts = await synchronizeIdentities({
    persons: new PostgresVerifiedPersons(database),
    identityProvider: new KeycloakUsers({
      baseUrl: config.IDENTITY_PROVIDER_URL,
      realm: config.IDENTITY_PROVIDER_REALM,
      clientId: config.IDENTITY_SYNC_CLIENT_ID,
      clientSecret: config.IDENTITY_SYNC_CLIENT_SECRET,
    }),
  })();
  log.info({ counts }, 'identity sync finished');
} catch (error) {
  log.error({ err: error }, 'identity sync failed');
  process.exitCode = 1;
} finally {
  await database.close();
}
