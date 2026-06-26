import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import sonarjs from 'eslint-plugin-sonarjs';
import importX from 'eslint-plugin-import-x';
import { createRequire } from 'node:module';
const _require = createRequire(import.meta.url);
const reactHooks = _require('eslint-plugin-react-hooks');
import globals from 'globals';

import noArbitraryTailwind from './eslint-rules/no-arbitrary-tailwind.mjs';

/**
 * Wolfkrow Tool — ESLint flat config (canônico, monorepo-wide).
 *
 * Guard-rails de qualidade (IMPLEMENTATION_PLAN.md §1.2) — bloqueiam CI:
 *   god class = arquivo > 300 linhas OU função > 50 linhas OU complexity > 10.
 *
 * Typed linting (projectService) habilitado apenas para no-floating-promises
 * (única regra type-aware do §1.2). recommendedTypeChecked não é usado: suas
 * regras no-unsafe-* não estão no plano e barulham em mocks/shadcn.
 * Regras declarativas (schema/seed/catalog) relaxam max-lines: são DATA,
 * não lógica — complexidade ciclomática/cognitiva continua enforced.
 */
export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: [
            'apps/web/app/.well-known/jwks.json/route.ts',
            'apps/web/.storybook/main.ts',
            'apps/web/.storybook/preview.ts',
            'apps/web/e2e/*.ts',
            'apps/web/e2e/helpers/*.ts',
            'apps/web/components/ui/*.stories.tsx',
          ],
          maximumDefaultProjectFileMatchCount_THIS_WILL_SLOW_DOWN_LINTING: 25,
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  {
    ignores: [
      '**/node_modules/',
      '**/dist/',
      '**/.next/',
      '**/.turbo/',
      '**/coverage/',
      '**/*.config.js',
      '**/*.config.mjs',
      '**/*.config.cjs',
      '**/*.config.ts',
      '**/postcss.config.js',
      '**/next-env.d.ts',
      '**/test-utils/*.mjs',
      '**/src/sw.d.ts',
      '**/public/sw.js',
      '**/*.stories.tsx',
      '**/*.stories.ts',
      'scripts/',
    ],
  },

  {
    files: ['**/*.{ts,tsx}'],
    plugins: { sonarjs, import: importX, 'react-hooks': reactHooks, wolfkrow: { rules: { 'no-arbitrary-tailwind': noArbitraryTailwind } } },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.browser,
      },
    },
    rules: {
      // — §1.2 limites de complexidade (god-class guard-rails) —
      'max-lines-per-function': [
        'error',
        { max: 50, skipComments: true, skipBlankLines: true },
      ],
      'max-lines': ['error', { max: 300, skipComments: true }],
      'max-params': ['error', 4],
      'complexity': ['error', 10],
      'max-depth': ['error', 3],
      'max-nested-callbacks': ['error', 3],
      'sonarjs/cognitive-complexity': ['error', 15],

      // — tipagem estrita —
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports' },
      ],
      '@typescript-eslint/no-floating-promises': 'error',

      // — ordem de imports (DRY visual / diffs menores) —
      'import/order': [
        'error',
        {
          'newlines-between': 'always',
          alphabetize: { order: 'asc' },
        },
      ],

      // — react hooks —
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // — higiene —
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'prefer-const': 'error',
      'no-else-return': ['error', { allowElseIf: false }],
    },
  },

  // FE-2: barra valores Tailwind arbitrários (text-[10px], bg-[#fff]) em
  // código nosso — usa tokens da escala. Permite refs CSS-var (w-[--sidebar-width]).
  // Vendor ui/ (gerado por CLI) desliga abaixo; testes/stories já estão em ignores.
  {
    files: ['apps/web/{app,components}/**/*.{ts,tsx}'],
    rules: {
      'wolfkrow/no-arbitrary-tailwind': 'error',
    },
  },

  // E2E specs + helpers are Playwright (not React) — the `use` fixture callback
  // trips react-hooks/rules-of-hooks. Disable it for the e2e directory.
  {
    files: ['**/e2e/**/*.{ts,tsx}'],
    rules: {
      'react-hooks/rules-of-hooks': 'off',
    },
  },

  // FE-2 tech-debt exceptions: graph (D3 canvas colors/sizes) and terminal
  // (xterm theme + bg-[#1a1a1a] console) use domain-specific literals.
  {
    files: ['**/components/graph/**', '**/components/terminal/**'],
    rules: {
      'wolfkrow/no-arbitrary-tailwind': 'off',
    },
  },

  // DATA declarativa (schemas Drizzle, seeds, catalogs built-in): sem limite
  // de linhas. Continua sujeita a complexity/cognitive (medem lógica, não dados).
  {
    files: [
      '**/db/schema/**',
      '**/db/seed.ts',
      '**/seed/**',
      '**/built-in-mcps.ts',
      '**/built-in-skills.ts',
    ],
    rules: {
      'max-lines': 'off',
      'max-lines-per-function': 'off',
    },
  },

  // Testes: fixtures/setup legitimamente > 50 linhas + constant conditions intencionais.
  {
    files: ['**/*.{test,spec}.{ts,tsx}', '**/__tests__/**'],
    rules: {
      'max-lines': 'off',
      'max-lines-per-function': 'off',
      'max-nested-callbacks': 'off',
      'no-constant-binary-expression': 'off',
    },
  },

  // shadcn/ui: componentes GERADOS por CLI (não código nosso).
  // Sidebar.tsx 579 linhas etc são normais para o kit. Components custom ficam
  // fora deste glob (components/<feature>/) e continuam enforced.
  {
    files: ['**/components/ui/**'],
    rules: {
      'max-lines': 'off',
      'max-lines-per-function': 'off',
      'complexity': 'off',
      'sonarjs/cognitive-complexity': 'off',
      'wolfkrow/no-arbitrary-tailwind': 'off',
    },
  },

  // ConsoleLogger é a implementação que legitimamente usa console.* (porta Logger).
  {
    files: ['**/use-cases/src/logger.ts'],
    rules: {
      'no-console': 'off',
    },
  },

  // TECH-DEBT (legado pré-Fase F — reescrito nas fases indicadas, override removido lá):
  //   login-form.tsx + middleware.ts → Fase A.1 (reimplementação auth total)
  //   repos/index.ts              → Fase F.3 (ports + base genérica substitui)
  //   lion.ts create()            → refactor quando adapter catalog crescer (T34+)
  {
    files: [
      '**/components/auth/login-form.tsx',
      '**/apps/web/middleware.ts',
      '**/infra/src/repos/index.ts',
      '**/infra/src/ai-providers/lion.ts',
    ],
    rules: {
      'max-lines-per-function': 'off',
      'complexity': 'off',
    },
  },
);
