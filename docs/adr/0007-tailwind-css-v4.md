# ADR-0007: Tailwind CSS v4 para Styling

**Status**: ✅ Aceito
**Data**: 2026-06-20

## Contexto

O LionClaw v3 já usa Tailwind CSS v4. Decisão mantida para o Wolfkrow Tool.

Tailwind v4 traz:

- CSS-first config (`@theme` direto no CSS)
- Container queries nativas
- Variants custom simplificados
- Performance melhorada (Lightning CSS)
- Tree-shaking automático

## Decisão

**Tailwind CSS v4** com **CSS-first configuration**.

```css
/* apps/web/app/globals.css */
@import 'tailwindcss';

@theme {
  --color-background: #0a0a0a;
  --color-foreground: #fafafa;
  --color-primary: #f59e0b;
  --color-primary-foreground: #18181b;
  /* ... */

  --font-sans: 'Inter', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', monospace;

  --radius: 0.5rem;
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}
```

```typescript
// apps/web/postcss.config.mjs (Next.js 15)
export default { plugins: { '@tailwindcss/postcss': {} } };
```

## Consequências

### Positivas

- **CSS-first**: config mais legível que `tailwind.config.ts`
- **Performance**: Lightning CSS é ~10x mais rápido
- **Tree-shaking**: classes não usadas são removidas
- **Container queries**: nativas (`@md:`, `@lg:`)
- **Variants custom**: mais fáceis de definir
- **Compatibilidade**: shadcn/ui é compatível

### Negativas

- **CSS variables**: mudança vs v3 (utility classes mudaram)
- **Documentação**: menos material que v3
- **Plugin ecosystem**: alguns plugins ainda não migraram

### Mitigações

- shadcn/ui é compatível com v4 (template oficial)
- Tailwind v4 plugin para Vite/PostCSS mantido
- Documentação oficial suficiente

## Design Tokens

Tokens centralizados em `packages/design-tokens/`:

```typescript
// packages/design-tokens/src/colors.ts
export const colors = {
  background: '0 0% 100%',
  foreground: '240 10% 3.9%',
  primary: '24 95% 53%',
  'primary-foreground': '0 0% 98%',
  // ...
} as const;
```

```typescript
// packages/design-tokens/src/theme.ts
export const lightTheme = {
  '--color-background': '0 0% 100%',
  '--color-foreground': '240 10% 3.9%',
  // ...
};

export const darkTheme = {
  '--color-background': '240 10% 3.9%',
  '--color-foreground': '0 0% 98%',
  // ...
};
```

## Dark Mode

```typescript
// apps/web/components/theme-provider.tsx
'use client';
import { ThemeProvider as NextThemesProvider } from 'next-themes';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="dark" enableSystem>
      {children}
    </NextThemesProvider>
  );
}
```

```tsx
// apps/web/app/layout.tsx
<html lang="pt-BR" suppressHydrationWarning>
  <body className={cn('bg-background min-h-screen font-sans antialiased')}>
    <ThemeProvider>{children}</ThemeProvider>
  </body>
</html>
```

## Alternativas Consideradas

### A. Tailwind v3 (status quo)

**Prós**: Maduro, documentação extensa
**Contras**: Já em v4, perderíamos melhorias
**Decisão**: ❌ Rejeitado — v4 é melhor

### B. CSS Modules

**Prós**: Native, sem build step
**Contras**: Verboso, sem utility classes
**Decisão**: ❌ Rejeitado — Tailwind é mais produtivo

### C. Vanilla Extract

**Prós**: Type-safe CSS-in-TS
**Contras**: Curva de aprendizado, ecossistema menor
**Decisão**: ❌ Rejeitado — Tailwind é mais popular

### D. styled-components / Emotion

**Prós**: CSS-in-JS, dynamic styles
**Contras**: Runtime overhead, vendor lock-in
**Decisão**: ❌ Rejeitado — Tailwind é build-time, mais performático

## References

- [Tailwind CSS v4](https://tailwindcss.com/)
- [next-themes](https://github.com/pacocoursey/next-themes)
- [Lightning CSS](https://lightningcss.dev/)
