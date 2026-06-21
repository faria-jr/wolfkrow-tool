import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';
import path from 'node:path';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts'],
    exclude: ['node_modules', 'dist'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov', 'json'],
      include: ['src/**/*.ts'],
      exclude: [
        'node_modules/',
        'dist/',
        'src/index.ts',
        'src/server.ts',
        '**/*.config.ts',
        '**/*.test.ts',
        '**/__tests__/**',
      ],
      // M0 baseline — §1.3 target 85: sobe quando rotas/plugins ganham testes
      // de integração nas fases A.3 (chat) e N.3 (mcp bridge).
      thresholds: {
        lines: 25,
        functions: 25,
        branches: 20,
        statements: 25,
      },
    },
  },
  resolve: {
    alias: {
      'drizzle-orm': path.resolve(
        __dirname,
        '../../node_modules/.pnpm/drizzle-orm@0.36.4_@types+better-sqlite3@7.6.13_@types+react@19.2.17_better-sqlite3@12.11.1_react@19.2.7/node_modules/drizzle-orm'
      ),
    },
  },
});
