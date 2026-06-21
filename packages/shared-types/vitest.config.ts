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
      // M0 baseline — §1.3 target 95: sobe conforme cada schema ganha testes
      // na fase que o consome (auth=A.1, chat=A.3, agents=N.1, mcp=N.3...).
      // functions=0: schemas Zod são declarativos (sem funções a cobrir).
      thresholds: {
        lines: 25,
        functions: 0,
        branches: 5,
        statements: 25,
      },
    },
  },
});
