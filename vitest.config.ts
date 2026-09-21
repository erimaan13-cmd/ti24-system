import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/*/test/**/*.test.ts', 'apps/*/test/**/*.test.ts'],
    environment: 'node',
    // Las pruebas de integración comparten una base de datos: se ejecutan en serie.
    fileParallelism: false,
    testTimeout: 20000,
  },
});
