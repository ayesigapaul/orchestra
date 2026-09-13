import { configDefaults, defineConfig } from 'vitest/config';

// Unit and adapter tests. The integration suite needs the local stack, so it runs on its own
// (vitest.integration.config.ts), and never quietly skips here.
export default defineConfig({
  test: { exclude: [...configDefaults.exclude, 'test/integration/**'] },
});
