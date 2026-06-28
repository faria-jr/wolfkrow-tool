# ADR-0021: Vitest como Test Runner

**Status**: ✅ Aceito
**Data**: 2026-06-20

## Contexto

Precisamos de test runner que:

- Seja rápido (vitest é mais rápido que Jest)
- TypeScript nativo (sem Babel config)
- Compatível com Jest API (fácil migração)
- Tenha UI mode
- Tenha coverage built-in
- Funcione com Next.js + Worker

## Decisão

**Vitest 2.x** como test runner padrão.

```typescript
// vitest.config.ts (root)
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node', // 'jsdom' para component tests
    setupFiles: ['./test-setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov', 'json'],
      exclude: [
        'node_modules/',
        'dist/',
        '.next/',
        '**/*.test.ts',
        '**/*.test.tsx',
        '**/__tests__/**',
      ],
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
      '@': path.resolve(__dirname, './src'),
      '@wolfkrow/*': path.resolve(__dirname, './packages/*'),
    },
  },
});
```

```typescript
// test-setup.ts
import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
});
```

## Consequências

### Positivas

- **Vite-native**: reusa config Vite (zero config duplicada)
- **TypeScript first**: sem Babel, usa esbuild
- **Watch mode rápido**: HMR para testes
- **UI mode**: `vitest --ui` abre DevTools
- **Coverage built-in**: v8 ou istanbul
- **Jest-compatible**: maioria das APIs são compatíveis

### Negativas

- **Ecossistema menor que Jest**: menos plugins
- **Mocks diferentes**: usa `vi.fn()` em vez de `jest.fn()`

### Mitigações

- `vi.fn()` ≈ `jest.fn()` (mesma API)
- `vi.mock()` ≈ `jest.mock()`
- Compatível com `@testing-library/react`

## Frameworks Auxiliares

- **`@testing-library/react`**: component tests
- **`@testing-library/user-event`**: interações reais
- **`@testing-library/jest-dom`**: matchers customizados
- **`msw`**: mock de HTTP/REST
- **`@vitest/ui`**: UI mode para debugging
- **`@vitest/coverage-v8`**: coverage rápido

## Alternativas Consideradas

### A. Jest

**Prós**: Maduro, ecossistema enorme
**Contras**: Mais lento, config TypeScript verbosa
**Decisão**: ❌ Rejeitado — Vitest é mais moderno

### B. Node Test Runner (built-in)

**Prós**: Zero deps
**Contras**: Sem UI, sem watch mode avançado
**Decisão**: ❌ Rejeitado — limitado

### C. Mocha + Chai

**Prós**: Maduro
**Contras**: Não-native TypeScript, mais boilerplate
**Decisão**: ❌ Rejeitado

## References

- [Vitest](https://vitest.dev/)
- [Testing Library React](https://testing-library.com/docs/react-testing-library/intro/)
- [MSW](https://mswjs.io/)
