import { defineConfig } from 'vitest/config';

// The integration suite: PostgreSQL through PgBouncer, on the local stack's network. Run by
// infra/compose/smoke.sh in the container test/integration.Dockerfile builds.
export default defineConfig({
  test: { include: ['test/integration/**/*.test.ts'] },
});
