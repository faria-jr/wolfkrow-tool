# ADR-0023: ESLint + Prettier + Husky para Qualidade

**Status**: ✅ Aceito
**Data**: 2026-06-20

## Contexto

O LionClaw v3 não tem lint, format, ou pre-commit hooks. Problemas:
1. **Inconsistência**: cada dev formata diferente
2. **Bugs comuns**: `any`, unused vars, console.log esquecidos
3. **Sem quality gate**: PRs merged com erros básicos
4. **Onboarding lento**: novos devs não sabem convenções

## Decisão

**ESLint 9** (flat config) + **Prettier 3** + **Husky** + **lint-staged**.

### `eslint.config.js` (Flat Config)

```javascript
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import importPlugin from 'eslint-plugin-import';
import next from '@next/eslint-plugin-next';

export default [
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
      },
    },
    plugins: {
      react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      import: importPlugin,
      '@next/next': next,
    },
    rules: {
      // TypeScript
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      
      // React
      'react/react-in-jsx-scope': 'off',  // Not needed with React 17+
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
      
      // Clean Code
      'max-lines-per-function': ['error', { max: 50, skipComments: true }],
      'max-params': ['error', { max: 4 }],
      'complexity': ['error', { max: 10 }],
      'max-depth': ['error', { max: 3 }],
      'max-nested-callbacks': ['error', { max: 3 }],
      'no-else-return': ['error', { allowElseIf: false }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'prefer-const': 'error',
      
      // Imports
      'import/order': ['error', {
        groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'type'],
        'newlines-between': 'always',
        alphabetize: { order: 'asc' },
      }],
      'import/no-duplicates': 'error',
    },
  },
];
```

### `.prettierrc`

```json
{
  "semi": true,
  "singleQuote": true,
  "jsxSingleQuote": false,
  "tabWidth": 2,
  "useTabs": false,
  "trailingComma": "es5",
  "bracketSpacing": true,
  "arrowParens": "always",
  "printWidth": 100,
  "plugins": ["prettier-plugin-tailwindcss"]
}
```

### Husky + lint-staged

```bash
# Install
pnpm add -Dw husky lint-staged
pnpm exec husky init
```

```json
// package.json
{
  "lint-staged": {
    "*.{ts,tsx,js,jsx}": [
      "eslint --fix",
      "prettier --write"
    ],
    "*.{json,md,yml,yaml}": [
      "prettier --write"
    ]
  }
}
```

```bash
# .husky/pre-commit
pnpm exec lint-staged
```

```bash
# .husky/commit-msg
pnpm exec commitlint --edit "$1"
```

### commitlint

```javascript
// commitlint.config.js
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [2, 'always', [
      'feat', 'fix', 'docs', 'style', 'refactor',
      'perf', 'test', 'chore', 'revert', 'build', 'ci'
    ]],
    'subject-max-length': [2, 'always', 72],
  },
};
```

## Consequências

### Positivas

- **Consistência**: código uniforme em todo repo
- **Bugs prevenidos**: regras pegam erros comuns
- **Auto-fix**: `--fix` resolve maioria
- **Quality gate**: PRs não merge sem lint green
- **Onboarding**: convenções claras desde dia 1

### Negativas

- **Slow down dev**: lint pode ser lento
- **False positives**: regras podem pegar código válido
- **Lock-in**: trocar ESLint é difícil

### Mitigações

- Cache ESLint (`.eslintcache`)
- Lint só staged files em pre-commit
- Rules configuráveis (não over-strict)

## Scripts

```json
{
  "scripts": {
    "lint": "eslint .",
    "lint:fix": "eslint . --fix",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "typecheck": "tsc --noEmit",
    "validate": "pnpm typecheck && pnpm lint && pnpm format:check"
  }
}
```

## Alternativas Consideradas

### A. Biome (Rome)

**Prós**: Mais rápido, all-in-one (lint + format)
**Contras**: Menos maduro, menos rules
**Decisão**: 🤔 Considerado para v2.0

### B. XO

**Prós**: Zero config
**Contras**: Menos customizável
**Decisão**: ❌ Rejeitado

### C. Standard JS

**Prós**: Sem config
**Contras**: Opinionado demais
**Decisão**: ❌ Rejeitado

## References

- [ESLint Flat Config](https://eslint.org/docs/latest/use/configure/configuration-files)
- [typescript-eslint](https://typescript-eslint.io/)
- [Prettier](https://prettier.io/)
- [Husky](https://typicode.github.io/husky/)
- [lint-staged](https://github.com/okonet/lint-staged)
- [commitlint](https://commitlint.js.org/)
