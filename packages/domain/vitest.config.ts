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
      exclude: [
        'src/**/index.ts',
        'src/__tests__/**',
        '**/*.config.ts',
        'src/repos/**',
        'src/services/ai-stream-port.ts',
        'src/services/embedding-port.ts',
        'src/services/password-hasher.ts',
        'src/services/totp-verifier.ts',
      ],
      // §1.3 domain gate — entidades/VOs são puros, sem mocks.
      thresholds: {
        lines: 95,
        functions: 90,
        branches: 85,
        statements: 95,
      },
    },
  },
});
