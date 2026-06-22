# Wolfkrow Tool

> Seu segundo cérebro, self-hosted, com superpoderes de IA.

Assistente pessoal de IA **100% local** (single-user, self-hosted) — refactor do LionClaw v3.0 para uma arquitetura limpa (Clean Architecture) sobre **Next.js 15 + Fastify + Drizzle (SQLite)**. Combina chat com streaming, acesso a terminal/filesystem, memória persistente (RAG + semântica), automação multi-stage (Harness/Pipeline), MCPs externos e total privacidade: nenhum dado sai da máquina sem permissão explícita.

---

## Sumário

- [Visão geral](#visão-geral)
- [Arquitetura](#arquitetura)
- [Monorepo](#monorepo)
- [Stack](#stack)
- [Pré-requisitos](#pré-requisitos)
- [Configuração rápida (quickstart)](#configuração-rápida-quickstart)
- [Variáveis de ambiente](#variáveis-de-ambiente)
- [Banco de dados](#banco-de-dados)
- [Scripts](#scripts)
- [Funcionalidades](#funcionalidades)
- [Testes](#testes)
- [Qualidade de código](#qualidade-de-código)
- [Empacotamento desktop (Electron)](#empacotamento-desktop-electron)
- [Roadmap](#roadmap)
- [Documentação](#documentação)

---

## Visão geral

Wolfkrow é um assistente pessoal que roda inteiro na sua máquina (desktop Electron ou PWA). Diferente de chatbots web genéricos, ele tem:

- **Acesso local** a terminal, filesystem e internet (não só chat).
- **Memória persistente** entre sessões (compaction, embeddings, semantic search).
- **Automação complexa** multi-stage: Harness (Planner→Coder→Evaluator) e Pipeline (BuildPlan multi-fase).
- **Integração MCP** (Google, Telegram, YouTube, Knowledge, Memory, etc).
- **Privacidade total** — dados ficam locais; chaves via keychain (keytar).
- **Customização** — agents, skills, prompts e regras globais editáveis.

Persona-alvo: desenvolvedor solo / founder técnico, researcher (RAG local) e power user (inbox zero, daily briefings via Telegram).

---

## Arquitetura

Três processos (clean architecture, dependência unidirecional `presentation → use-cases → domain`):

```
┌─────────────────────┐        ┌─────────────────────┐
│  apps/web (Next 15) │  HTTP  │  apps/worker        │
│  Porta 3000         │ ────►  │  (Fastify) Porta 4000│
│  UI + BFF (cookies) │        │  Domínio + rotas    │
└─────────────────────┘        └─────────┬───────────┘
                                          │
                           ┌──────────────┴──────────────┐
                           │  packages/infra (Drizzle)   │
                           │  SQLite + sqlite-vec        │
                           │  .wolfkrow/data/wolfkrow.db │
                           └─────────────────────────────┘
```

- **Web (`apps/web`)** — Next.js 15 (App Router). Server Components + Route Handlers (BFF) que validam a sessão (cookie) e repassam `Authorization: Bearer` ao worker. UI em shadcn/Radix + Tailwind 4.
- **Worker (`apps/worker`)** — Fastify 5. Orquestra domínio, MCPs, schedulers, pipelines. Autentica cada rota via JWT (JWKS) emitido pelo web.
- **Packages** — `domain` (entidades, ports), `use-cases` (1 caso de uso = 1 classe, DI), `infra` (Drizzle repos, AI providers, auth, secrets/keytar, doc parsers), `design-tokens`, `shared-types`.

Auth: senha + TOTP, keypair JWT ES256 persistido no keychain (keytar) — não efêmero. `apps/web/middleware.ts` faz auth-gate em todas as rotas `(app)/*`. Worker valida tokens via JWKS exposto pelo web em `/.well-known/jwks.json`.

---

## Monorepo

Gerenciado por **pnpm workspaces + Turborepo**.

```
apps/
  web/        → @wolfkrow/web      (Next.js 15 — UI + BFF)
  worker/     → @wolfkrow/worker   (Fastify — API + domínio)
packages/
  domain/         → @wolfkrow/domain        (Clean Arch: entidades, ports)
  use-cases/      → @wolfkrow/use-cases     (casos de uso + DI)
  infra/          → @wolfkrow/infra         (Drizzle, AI providers, auth, secrets)
  design-tokens/  → @wolfkrow/design-tokens (tokens Tailwind/CSS)
  shared-types/   → @wolfkrow/shared-types
docs/             → PRD, ARCHITECTURE, IMPLEMENTATION_PLAN, FEATURE_MATRIX, specs/, adr/
```

---

## Stack

| Camada | Tecnologia |
|---|---|
| Web | Next.js 15, React 19, TypeScript, Tailwind 4, shadcn/Radix, TanStack Query, Zustand, react-hook-form + Zod, recharts, d3, xterm, react-markdown |
| Worker | Fastify 5, TypeScript, Drizzle ORM, better-sqlite3 + sqlite-vec, pino, jose (JWT), keytar, node-pty, node-telegram-bot-api, pdf-parse/mammoth/xlsx (parsers) |
| Embeddings | Voyage (`VOYAGE_API_KEY`) — Knowledge/RAG |
| Testes | Vitest, Testing Library, Playwright (E2E), MSW |
| Tooling | pnpm 9, Turborepo 2, ESLint 9 (regras estritas), Prettier, Husky + commitlint |
| Desktop | Electron 33, electron-builder |

---

## Pré-requisitos

- **Node.js ≥ 20**
- **pnpm ≥ 9** (`corepack enable && corepack prepare pnpm@9 --activate`)
- macOS / Linux / Windows. `keytar` e `better-sqlite3` são nativos (compilados no `pnpm install`).

---

## Configuração rápida (quickstart)

```bash
# 1. Clonar e instalar
git clone <repo-url> wolfkrow-tool && cd wolfkrow-tool
pnpm install            # compila nativos (better-sqlite3, keytar, node-pty)

# 2. Configurar env
cp .env.example .env    # ajuste conforme necessário

# 3. Buildar os packages internos (domain/use-cases/infra) — necessário antes de migrate/typecheck
pnpm build

# 4. Criar/migrar o banco SQLite
pnpm db:migrate         # cria .wolfkrow/data/wolfkrow.db com todas as tabelas

# 5. Rodar web + worker em paralelo (dev)
pnpm dev                # web → :3000 · worker → :4000
```

Abra **http://localhost:3000**. Na 1ª execução: onboarding (senha → escolha de SDK).

> **DB path:** o SQLite é resolvido em `$HOME/.wolfkrow/data/wolfkrow.db` por default (FIX-001 — independente do cwd, então web/worker/migrate compartilham o **mesmo** arquivo). Override via `WOLFKROW_DB_PATH` (absoluto). Na primeira execução após o upgrade, o DB antigo (cwd-relativo) não é encontrado — re-faça onboarding ou aponte `WOLFKROW_DB_PATH` para o arquivo antigo.

### Iniciar o sistema

Todos os comandos a partir da **raiz do repo**. `pnpm dev` sobe os dois processos via `concurrently`:

```bash
pnpm dev
```

Expansão (`package.json` raiz → `pnpm dev:web` + `pnpm dev:worker`):

| Processo | Cmd efetivo | cwd | Porta |
|---|---|---|---|
| Web | `next dev --port 3000` | `apps/web` | `3000` |
| Worker | `tsx watch src/index.ts` | `apps/worker` | `4000` |

Endpoints úteis: UI **http://localhost:3000** · Worker health **http://localhost:4000/health** · Swagger **http://localhost:4000/docs**.

Reproduzir do zero:

```bash
pnpm install && cp .env.example .env && pnpm build && pnpm db:migrate && pnpm dev
```

Produção: `pnpm build` depois `pnpm start` (web `next start` + worker `node dist/index.js`).

> **Node 24 / nativos:** `better-sqlite3`, `keytar` e `node-pty` são módulos nativos compilados no `pnpm install`. Se houver erro `NODE_MODULE_VERSION` (binário compilado p/ outra versão do Node), recompile — ex.: `node-gyp rebuild --release` dentro de `node_modules/.pnpm/better-sqlite3@<v>/node_modules/better-sqlite3`.

---

## Variáveis de ambiente

Cópie de [`.env.example`](.env.example). Principais:

| Var | Onde | Default | Descrição |
|---|---|---|---|
| `WORKER_URL` / `NEXT_PUBLIC_WORKER_URL` | web | `http://localhost:4000` | URL do worker (BFF) |
| `WOLFKROW_DB_PATH` | ambos | `.wolfkrow/data/wolfkrow.db` | Caminho do SQLite (use absoluto p/ consistência) |
| `PORT` | worker | `4000` | Porta do worker |
| `HOST` | worker | `127.0.0.1` | Bind do worker |
| `WORKER_SECRET` | worker | dev default | Secret interno (≥32 chars; **obrigatório em prod**) |
| `JWKS_URL` | worker | `http://localhost:3000/.well-known/jwks.json` | JWKS do web p/ validar JWT |
| `LOG_LEVEL` | worker | `info` | `trace\|debug\|info\|warn\|error\|fatal` |
| `VOYAGE_API_KEY` | ambos | — | Embeddings Voyage (Knowledge/RAG search). Opcional se não usar RAG |

Chaves de providers (Anthropic, OpenAI, ElevenLabs, Cartesia, Telegram bot token, etc) são lidas do **Vault** (keytar) em runtime, não de env.

---

## Banco de dados

SQLite via **Drizzle ORM** + extensão **sqlite-vec** (vetores para RAG).

```bash
pnpm db:generate    # gera migration SQL a partir do schema (packages/infra/drizzle)
pnpm db:migrate     # aplica migrations
pnpm db:studio      # Drizzle Studio (GUI)
```

Schema-fonte: `packages/infra/src/db/schema/` (37 tabelas: auth, agents, skills, knowledge, memory, harness, pipeline, enrich, scheduler, vault, usage, rules, tasks, graph, etc).

---

## Scripts (raiz)

| Script | Ação |
|---|---|
| `pnpm dev` | Web + Worker em paralelo (dev) |
| `pnpm start` | Web + Worker em paralelo (produção) |
| `pnpm build` | Builda todos os workspaces (`turbo build`) |
| `pnpm lint` / `lint:fix` | ESLint (`turbo lint`) |
| `pnpm typecheck` | `tsc --noEmit` em todos (`turbo typecheck`) |
| `pnpm test` / `test:cov` / `test:watch` | Vitest (`turbo test`) |
| `pnpm test:e2e` | Playwright |
| `pnpm db:generate` / `db:migrate` / `db:studio` | Drizzle |
| `pnpm storybook` | Storybook (web) |
| `pnpm format` / `format:check` | Prettier |
| `pnpm dist:mac` / `dist:win` / `dist:linux` / `dist:all` | Empacota Electron |

Scripts por app: ver [`apps/web/README.md`](apps/web/README.md) e [`apps/worker/README.md`](apps/worker/README.md).

---

## Funcionalidades

Cobertura por área (status real por commit log):

| Área | Feature | Onde (UI) |
|---|---|---|
| **Chat** | Streaming SSE multi-SDK (Anthropic, Claude-compat, Codex, Lion) | Chat |
| **Agents/Skills** | CRUD + runtime, skills markdown+frontmatter | Agents, Skills |
| **MCP** | Lifecycle de servidores MCP + catalog (18) | MCP Servers |
| **Knowledge** | Ingest (PDF/DOCX/XLSX/MD/URL) → chunk → embed → search híbrido | Knowledge |
| **Memory** | Compaction, daily summary, semantic memory + dreaming | Memory |
| **Scheduler** | Cron engine + tasks (kanban) | Scheduler, Tasks |
| **Harness** | Planner→Coder→Evaluator, sprints/rounds/métricas | Harness |
| **Pipeline** | BuildPlan multi-fase + aprovações | Pipeline |
| **Enrich/Workflow** | Validator→Enricher + WorkflowRun | (worker) |
| **Voice** | STT (Whisper) + TTS (ElevenLabs/Cartesia) | (worker + UI orb) |
| **Terminal** | CodeBurn — PTY interativo (node-pty) | Terminal |
| **Telegram** | Bridge bot conversacional + channels | Channels, Telegram |
| **Vault** | Segredos via keytar (valores nunca no DB/log) | Vault |
| **Usage/Pricing** | Analytics de tokens + PricingCalculator multi-fonte | Usage |
| **Logs** | Live-tail SSE + filtros | Logs |
| **Permissions** | Whitelist/blacklist de tools + audit log | Permissions |
| **Rules** | Regras globais editáveis injetadas no prompt | Rules |
| **Graph** | Knowledge graph (ingest entidades/relações + D3 force view) | Graph |

Matriz completa de rastreabilidade (55 features do LionClaw): [`docs/FEATURE_MATRIX.md`](docs/FEATURE_MATRIX.md).

---

## Testes

```bash
pnpm test            # todos os workspaces
pnpm test:cov        # com coverage
pnpm test:e2e        # Playwright
```

Cobertura (gates CI): `domain ≥ 95%`, `use-cases ≥ 90%`, `infra ≥ 85%`, `worker ≥ 85%`, `web ≥ 70%` (≥80% em auth/voice/pagamento).

---

## Qualidade de código

ESLint com regras estritas que **bloqueiam CI**:

- `max-lines-per-function: 50` · `max-lines: 300` · `max-params: 4` · `complexity: 10` · `max-depth: 3` · `max-nested-callbacks: 3`
- `sonarjs/cognitive-complexity: 15`
- `@typescript-eslint/no-explicit-any` · `no-floating-promises` · `consistent-type-imports`
- `import/order` (grupos + alfabético)

Commits via **commitlint (conventional)** + **husky** pre-commit (lint-staged).

Definição de god class neste projeto: arquivo > 300 linhas OU classe com > 1 responsabilidade — **bloqueado por lint**.

---

## Empacotamento desktop (Electron)

```bash
pnpm build
pnpm dist:mac        # DMG (x64 + arm64)
pnpm dist:win        # NSIS
pnpm dist:linux      # AppImage
pnpm dist:all        # todos
```

> O wrapper Electron (`apps/wrapper`) e PWA estão previstos na **Fase D** do roadmap (ainda não implementados).

---

## Roadmap

Plano v2 por milestones (detalhe em [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md)):

- **M0** Fundação Clean Arch ✅
- **M1** Auth + Chat streaming ✅
- **M2** Núcleo (agents, skills, MCP, knowledge, memory, scheduler) ✅
- **M3** Automação (harness, pipeline, enrich, voice, pty, telegram) ✅
- **M4** Superfícies (vault, usage, logs, permissions, rules, tasks, graph) ✅
- **M5** Distribuição (Electron, PWA, migrador LionClaw→Wolfkrow) ⏳
- **M6** Hardening + beta + v1.0 ⏳

---

## Documentação

- [`docs/PRD.md`](docs/PRD.md) — Requisitos de produto (visão, personas, proposta de valor)
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — Arquitetura detalhada
- [`AGENT.md`](AGENT.md) — Guia para agentes de IA
- [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md) — Plano por fases
- [`docs/FEATURE_MATRIX.md`](docs/FEATURE_MATRIX.md) — Rastreabilidade das 55 features
- [`docs/specs/`](docs/specs/) — SPEC-001 a SPEC-022
- [`docs/adr/`](docs/adr/) — Architectural Decision Records

---

**Licença**: UNLICENSED · **Autor**: Wolfkrow Labs
