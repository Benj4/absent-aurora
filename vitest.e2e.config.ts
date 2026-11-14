import { defineConfig } from 'vitest/config';

if (process.env.CI) throw new Error('E2E solo se ejecuta manualmente fuera de CI.');
export default defineConfig({
  test: {
    environment: 'node',
    globalSetup: ['scripts/e2e-global-setup.mjs'],
    setupFiles: ['scripts/e2e-setup.mjs'],
    include: ['tests/e2e/cases/**/*.e2e.ts'],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
    passWithNoTests: false,
  },
});
