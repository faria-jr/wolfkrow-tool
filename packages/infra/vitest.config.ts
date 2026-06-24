import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov', 'json'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/db/seed.ts',
        'src/db/migrate.ts',
        'src/seed/**',
        'src/**/index.ts',
        'src/**/__tests__/**',
        '**/*.test.ts',
        '**/*.config.ts',
      ],
      // M0 baseline — §1.3 target 85: sobe quando repos (F.3) e providers (A.2)
      // ganharem testes. Hoje só db/client é testado.
      thresholds: {
        lines: 25,
        functions: 20,
        branches: 20,
        statements: 25,
      },
    },
  },
  resolve: {
    alias: {
      '@wolfkrow/shared-types': path.resolve(__dirname, '../shared-types/src/index.ts'),
    },
  },
});
