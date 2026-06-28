import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', '.next', 'dist', 'e2e/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov', 'json'],
      exclude: [
        'node_modules/',
        '.next/',
        'dist/',
        '**/*.config.{ts,js,mjs}',
        '**/*.test.{ts,tsx}',
        '**/*.spec.{ts,tsx}',
        '**/__tests__/**',
        '**/types.ts',
        'components/ui/**',
        'lib/presentation/**',
        'app/**/layout.tsx',
        'app/**/loading.tsx',
        'app/**/error.tsx',
        'app/**/not-found.tsx',
        'app/**/page.tsx',
        'app/api/**',
        'app/.well-known/**',
        'middleware.ts',
        'lib/auth.ts',
      ],
      // M0 baseline — §1.3 target 70 (auth 80): sobe quando componentes custom
      // (ChatView A.3, AgentFormModal N.1...) ganharem testes RTL.
      thresholds: {
        lines: 20,
        functions: 40,
        branches: 35,
        statements: 20,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
      '@wolfkrow/design-tokens': path.resolve(
        __dirname,
        '../../packages/design-tokens/src/index.ts'
      ),
      '@wolfkrow/infra': path.resolve(__dirname, '../../packages/infra/src/index.ts'),
      '@wolfkrow/shared-types': path.resolve(__dirname, '../../packages/shared-types/src/index.ts'),
    },
  },
});
