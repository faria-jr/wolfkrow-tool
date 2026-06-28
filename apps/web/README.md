# @wolfkrow/web

App **Next.js 15** (App Router) do Wolfkrow — UI + BFF (API gateway). Porta **3000**.

Renderiza toda a interface (shadcn/Radix + Tailwind 4) e atua como **BFF**: Route Handlers em `app/api/*` validam a sessão (cookie HttpOnly) e proxiam para o worker com `Authorization: Bearer`. Nenhuma chave/secreto vai ao browser — o worker é quem fala com providers/DB.

> Veja o [README raiz](../../README.md) para visão geral, arquitetura e quickstart do monorepo.

---

## Sumário

- [Stack](#stack)
- [Pré-requisitos](#pré-requisitos)
- [Configuração](#configuração)
- [Executar](#executar)
- [Build](#build)
- [Testes](#testes)
- [Variáveis de ambiente](#variáveis-de-ambiente)
- [Estrutura](#estrutura)
- [Páginas / Funcionalidades](#páginas--funcionalidades)
- [Padrões](#padrões)

---

## Stack

- **Next.js 15** (App Router, RSC, Route Handlers, Server Actions)
- **React 19** + **TypeScript**
- **Tailwind CSS 4** + **shadcn/ui** (Radix primitives)
- **TanStack Query** (server state) + **Zustand** (client state)
- **react-hook-form** + **Zod** (formulários/validação)
- **recharts** (charts), **d3** (graph), **xterm** (terminal), **react-markdown** (chat)
- **jose** (JWT verify da sessão)

---

## Pré-requisitos

- Node ≥ 20, pnpm ≥ 9
- Pacotes internos buildados: `pnpm build` na raiz (gera `packages/*/dist`)
- Worker rodando em `WORKER_URL` (default `http://localhost:4000`)
- Keypair JWT gerado (auto na 1ª execução via `@wolfkrow/infra` → keytar)

---

## Configuração

```bash
# na raiz do monorepo
pnpm install
pnpm build              # builda packages internos (infra/domain/use-cases)
cp .env.example .env    # ajustar WORKER_URL, VOYAGE_API_KEY (opcional)
pnpm db:migrate         # garante tabelas (compartilha DB com worker)
```

---

## Executar

```bash
# a partir da raiz
pnpm dev:web            # next dev --port 3000

# ou isolado
pnpm --filter @wolfkrow/web dev
```

UI em **http://localhost:3000**. Fluxo: `/onboarding` (1ª vez) → `/login` → rotas `(app)/*`.

Produção: `pnpm --filter @wolfkrow/web start` (após `build`).

---

## Build

```bash
pnpm --filter @wolfkrow/web build      # next build → .next/
pnpm --filter @wolfkrow/web typecheck  # tsc --noEmit
pnpm --filter @wolfkrow/web lint       # eslint .
pnpm --filter @wolfkrow/web lint:fix
```

---

## Testes

```bash
pnpm --filter @wolfkrow/web test          # vitest run (unit + component)
pnpm --filter @wolfkrow/web test:watch
pnpm --filter @wolfkrow/web test:cov      # com coverage
pnpm --filter @wolfkrow/web test:e2e      # playwright
pnpm --filter @wolfkrow/web test:e2e:ui
```

- Unit/component: **Vitest** + **Testing Library** + **jsdom** (config `vitest.config.ts`, setup `tests/setup.ts`).
- Mocks: **MSW** para fetch; componentes pesados (ex.: D3) são stubados em smoke tests.
- Coverage gate: web ≥ 70% (≥80% em auth/pagamento).
- Storybook: `pnpm --filter @wolfkrow/web storybook` (porta 6006).

---

## Variáveis de ambiente

| Var                      | Default                      | Descrição                                           |
| ------------------------ | ---------------------------- | --------------------------------------------------- |
| `WORKER_URL`             | `http://localhost:4000`      | URL do worker (Route Handlers BFF)                  |
| `NEXT_PUBLIC_WORKER_URL` | —                            | URL exposta ao browser quando necessário            |
| `VOYAGE_API_KEY`         | —                            | Embeddings (search Knowledge client-side). Opcional |
| `WOLFKROW_DB_PATH`       | `.wolfkrow/data/wolfkrow.db` | SQLite — use o **mesmo** path do worker             |
| `NODE_ENV`               | —                            | `development\|production`                           |

---

## Estrutura

```
apps/web/
  app/
    (auth)/            # login, onboarding, unlock (sem auth-gate)
    (app)/             # rotas autenticadas (auth-gate via middleware.ts)
      chat/ agents/ skills/ mcp-servers/ knowledge/ memory/
      scheduler/ tasks/ harness/ pipeline/ terminal/
      vault/ usage/ logs/ permissions/ rules/ channels/ graph/
    api/               # Route Handlers (BFF → worker)
      auth/ chat/ knowledge/ memory/ graph/ ... (um proxy por domínio)
    .well-known/       # JWKS exposto ao worker (validação JWT)
    layout.tsx globals.css page.tsx
  middleware.ts        # auth-gate em (app)/*
  components/
    ui/                # shadcn primitives (button, card, dialog, table, ...)
    common/            # sidebar, auto-lock, theme/query providers
    <dominio>/         # componentes de feature (chat, graph, tasks, ...)
  lib/                 # auth (sessão/JWT), utils, presentation stores
  hooks/               # hooks reutilizáveis
  tests/               # setup vitest
```

---

## Páginas / Funcionalidades

| Rota           | Feature                                                           |
| -------------- | ----------------------------------------------------------------- |
| `/chat`        | Chat com streaming SSE (markdown, tool calls inline, attachments) |
| `/agents`      | CRUD de sub-agentes + runtime                                     |
| `/skills`      | Editor de skills (markdown + frontmatter)                         |
| `/mcp-servers` | Lifecycle de MCP servers (start/stop/restart) + catalog           |
| `/knowledge`   | Ingest de docs + busca semântica híbrida                          |
| `/memory`      | Memória semântica (compaction, daily, dreaming)                   |
| `/scheduler`   | Tarefas cron (engine + preview)                                   |
| `/tasks`       | Board kanban de tarefas                                           |
| `/harness`     | Sprints/rounds (Planner→Coder→Evaluator)                          |
| `/pipeline`    | BuildPlan multi-fase + aprovações                                 |
| `/terminal`    | CodeBurn — terminal PTY interativo (xterm)                        |
| `/vault`       | Segredos via keytar (mascarados)                                  |
| `/usage`       | Analytics de tokens + pricing                                     |
| `/logs`        | Live-tail de logs (filtros)                                       |
| `/permissions` | Whitelist/blacklist de tools + audit                              |
| `/rules`       | Regras globais (injetadas no prompt)                              |
| `/channels`    | Gestão de canais (Telegram)                                       |
| `/graph`       | Knowledge graph (D3 force-directed)                               |

---

## Padrões

- **BFF**: todo acesso ao worker passa por `app/api/*` (cookie session → `Authorization: Bearer`). O browser nunca chama o worker diretamente.
- **Auth-gate**: `middleware.ts` redireciona `/login` se sem sessão válida em `(app)/*`.
- **Server Components** por default; `'use client'` só onde há estado/interação.
- **Componentização**: funções ≤ 50 linhas, complexidade ≤ 10, aninhamento ≤ 3 (ESLint estrito).
- **Imports**: `import/order` com grupos separados e alfabético.
