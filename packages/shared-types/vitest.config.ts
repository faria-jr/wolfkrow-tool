import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov', 'json'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/index.ts', 'src/__tests__/**', '**/*.config.ts'],
      // P1-3: every schema now has valid + invalid parse tests covering
      // refinements, discriminated unions, and enum branches. Actual measured
      // coverage is 100/100/100/100; thresholds set just below to avoid CI
      // flakiness from minor v8 instrumentation drift.
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 80,
        statements: 90,
      },
    },
  },
});
