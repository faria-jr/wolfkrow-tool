# ADR-0001: Usar Next.js 15 como Framework Principal

**Status**: ✅ Aceito
**Data**: 2026-06-20

## Contexto

O LionClaw v3 usa Electron + React 19 + Vite como renderer. Para o Wolfkrow Tool, precisamos decidir entre:

1. Manter Electron + Vite (status quo)
2. Migrar para Next.js 15 com Electron wrapper
3. Migrar para Next.js 15 standalone (web app)

O LionClaw é single-user, single-machine, mas tem várias features que dependem de capabilities desktop (SQLite local, keychain, MCPs spawnados, Whisper local, etc).

## Decisão

**Usar Next.js 15 como framework principal** para frontend + API gateway, com Worker Node.js separado para background tasks.

Arquitetura final:

- `apps/web/` → Next.js 15 (UI + Route Handlers + Server Components + Server Actions)
- `apps/worker/` → Node.js long-running (MCPs, scheduler, Telegram, voice, dreaming)
- `apps/wrapper/` → Electron mínimo (~300 linhas: systray + hotkey + auto-launch)

## Consequências

### Positivas

- **Server Components**: 70% das pages são RSC (zero JS ao browser), melhor FCP/TTI
- **Server Actions**: mutations simples sem boilerplate de API
- **Streaming SSR**: Suspense boundaries + Partial Prerendering
- **shadcn/ui**: 49+ componentes prontos com Tailwind
- **Roteamento file-based**: App Router com layouts aninhados
- **TypeScript first**: zero-config TypeScript strict
- **PWA support**: Serwist integrado
- **SEO/Open Graph**: metadata API
- **Deploy flexibility**: Vercel, self-hosted, Docker

### Negativas

- **Bundle size maior** que Vite puro (Next.js runtime ~100KB)
- **Mais complexo** que Vite (3 processos: Next + Worker + Browser)
- **Vendor lock-in parcial** em Next.js APIs (RSC, Server Actions)

### Mitigações

- Code-splitting agressivo + dynamic imports
- Turborepo cache para build incremental
- Worker separado isola complexidade

## Alternativas Consideradas

### A. Manter Electron + Vite (status quo)

**Prós**: Já funciona, sem migração
**Contras**: Não aproveita RSC, Server Actions; vendor lock-in Vite/Electron
**Decisão**: ❌ Rejeitado — perdemos benefícios significativos do Next.js

### B. Next.js standalone web (sem Electron)

**Prós**: Mais simples, distribuição web
**Contras**: Perderia features desktop (keytar, MCPs spawnados, Whisper local, etc) sem Worker
**Decisão**: ❌ Rejeitado — features críticas dependem de OS access

### C. Tauri (Rust) em vez de Electron wrapper

**Prós**: Binário menor (~10MB vs ~80MB), mais rápido, Rust memory safety
**Contras**: Ecossistema menor, menos recursos prontos, learning curve
**Decisão**: 🤔 Adiada — pode ser considerado em v2.0 se wrapper Electron mostrar problemas

### D. SvelteKit / Remix / Nuxt

**Prós**: Frameworks alternativos sólidos
**Contras**: Menos ecossistema que Next.js, menos componentes prontos
**Decisão**: ❌ Rejeitado — Next.js tem melhor DX + ecossistema para nosso caso

## Referências

- [Next.js 15 Docs](https://nextjs.org/docs)
- [React Server Components RFC](https://github.com/reactjs/rfcs/blob/main/text/0188-server-components.md)
- [Clean Architecture + Next.js](https://blog.codeminer42.com/clean-architecture-with-next-js/)
- [LionClaw v3 → Wolfkrow Analysis](../../analysis.md)
