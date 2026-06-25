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
      // P1-2 — tdd-mandatory backend target. Routes/plugins/repos now have
      // meaningful integration tests (happy/error/auth paths); see
      // src/routes/__tests__/, src/plugins/__tests__/, src/*/__tests__/.
      thresholds: {
        lines: 85,
        functions: 85,
        branches: 80,
        statements: 85,
      },
    },
  },
  resolve: {
    alias: {
      'drizzle-orm': path.resolve(
        __dirname,
        '../../node_modules/.pnpm/drizzle-orm@0.36.4_@types+better-sqlite3@7.6.13_@types+react@19.2.17_better-sqlite3@12.11.1_react@19.2.7/node_modules/drizzle-orm'
      ),
      // better-sqlite3 is a transitive dep of @wolfkrow/infra; alias it so
      // worker tests can spin up an in-memory SQLite without adding a runtime dep.
      'better-sqlite3': path.resolve(
        __dirname,
        '../../node_modules/.pnpm/better-sqlite3@12.11.1/node_modules/better-sqlite3'
      ),
    },
  },
});
