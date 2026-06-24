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
      // Updated after LOW-9 — added filesystem-tool + batch-runner tests.
      // Goal: continue adding tests until reaching §1.3 target of 85%.
      thresholds: {
        lines: 70,
        functions: 75,
        branches: 60,
        statements: 70,
      },
    },
  },
  resolve: {
    alias: {
      '@wolfkrow/shared-types': path.resolve(__dirname, '../shared-types/src/index.ts'),
    },
  },
});
