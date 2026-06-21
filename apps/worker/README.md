# @wolfkrow/worker

Backend **Fastify 5** do Wolfkrow — API + orquestração de domínio. Porta **4000**.

Processo Node que concentra: regras de negócio, acesso ao SQLite (Drizzle), spawn de MCPs, schedulers, pipelines, PTY, Telegram, voice (STT/TTS) e auth (validação JWT via JWKS do web). Não expõe UI; é consumido pelo [`@wolfkrow/web`](../web/README.md) via Route Handlers (BFF).

> Veja o [README raiz](../../README.md) para visão geral, arquitetura e quickstart do monorepo.

---

## Sumário

- [Stack](#stack)
- [Pré-requisitos](#pré-requisitos)
- [Configuração](#configuração)
- [Executar](#executar)
- [Build](#build)
- [Testes](#testes)
- [Configuração (env)](#configuração-env)
- [Estrutura](#estrutura)
- [Rotas](#rotas)
- [Auth](#auth)
- [MCPs / Providers / Secrets](#mcps--providers--secrets)

---

## Stack

- **Fastify 5** + **TypeScript**
- **Drizzle ORM** + **better-sqlite3** + **sqlite-vec** (vetores RAG)
- **pino** (logger), **jose** (JWT/JWKS)
- **keytar** (keychain p/ segredos + keypair JWT)
- **node-pty** (terminal), **node-telegram-bot-api** (Telegram)
- Parsers: **pdf-parse**, **mammoth**, **xlsx**, **csv-parse**, **remark/turndown** (markdown)
- **cron-parser** (scheduler), **zod** (validação config)

---

## Pré-requisitos

- Node ≥ 20, pnpm ≥ 9
- Pacotes internos buildados: `pnpm build` na raiz (`packages/infra/dist` é consumido via `exports`)
- `better-sqlite3`/`keytar`/`node-pty` compilados (`pnpm install` na raiz)
- Web rodando (expõe JWKS em `JWKS_URL`) para validação de JWT

---

## Configuração

```bash
# na raiz do monorepo
pnpm install
pnpm build              # builda infra/domain/use-cases (worker importa de dist)
cp .env.example .env    # WORKER_SECRET, JWKS_URL, VOYAGE_API_KEY...
pnpm db:migrate         # cria/migra SQLite (mesmo DB lido pelo web)
```

> Seed de agents/skills: o loader existe em `src/seed-agents/` (loader + schema), mas ainda não há script `seed:agents` neste package.

---

## Executar

```bash
# a partir da raiz
pnpm dev:worker         # tsx watch src/index.ts

# ou isolado
pnpm --filter @wolfkrow/worker dev
```

Dev usa **tsx** (TS direto, hot reload). Produção: `node dist/index.js` (após `build`).

Docs interativa (Swagger UI): **http://localhost:4000/docs** · Health: **http://localhost:4000/health**.

---

## Build

```bash
pnpm --filter @wolfkrow/worker build       # tsc → dist/
pnpm --filter @wolfkrow/worker typecheck   # tsc --noEmit
pnpm --filter @wolfkrow/worker lint        # eslint src/
```

> O `typecheck` mapeia `drizzle-orm` e `drizzle-orm/better-sqlite3` via `tsconfig.json` `paths` (pnpm strict). `better-sqlite3` ganha types via `@types/better-sqlite3` (devDep).

---

## Testes

```bash
pnpm --filter @wolfkrow/worker test          # vitest run
pnpm --filter @wolfkrow/worker test:watch
pnpm --filter @wolfkrow/worker test:cov      # com coverage
```

- **Vitest** (config `vitest.config.ts`).
- Lógica de domínio testada com **mocks** (repositórios/executors). Persistência testada com **SQLite in-memory** (`:memory:` + Drizzle) onde aplicável.
- Alias de teste: `better-sqlite3` e `drizzle-orm` resolvidos via `resolve.alias` no `vitest.config.ts`.
- Coverage gate: worker ≥ 85%.

---

## Configuração (env)

Validada por Zod em [`src/config.ts`](src/config.ts):

| Var | Default | Descrição |
|---|---|---|
| `PORT` | `4000` | Porta HTTP |
| `HOST` | `127.0.0.1` | Bind |
| `WORKER_SECRET` | dev default | Secret interno (≥32 chars; **obrigatório em prod**, lança se ausente) |
| `JWKS_URL` | `http://localhost:3000/.well-known/jwks.json` | JWKS do web (validar JWT) |
| `WORKER_POLL_INTERVAL_MS` | `60000` | Intervalo de poll (scheduler) |
| `LOG_LEVEL` | `info` | `trace\|debug\|info\|warn\|error\|fatal` |
| `WOLFKROW_DB_PATH` | `.wolfkrow/data/wolfkrow.db` | SQLite (mesmo path do web) |
| `VOYAGE_API_KEY` | — | Embeddings (Knowledge/RAG) |
| `NODE_ENV` | `development` | `development\|test\|production` |

Variáveis de runtime (tokens Telegram, chaves voice/STT/TTS, providers AI) são lidas do **Vault** (keytar), não do env.

---

## Estrutura

```
apps/worker/src/
  index.ts             # entrypoint (sobe createServer)
  server.ts            # createServer(): registra plugins + rotas + error handler
  config.ts            # env validado por Zod
  logger.ts            # pino
  routes/              # route groups (Fastify plugins)
    knowledge.ts memory.ts scheduler.ts harness.ts pipeline.ts
    enrich.ts voice.ts chat.ts mcp.ts pty.ts telegram.ts vault.ts
    usage.ts logs.ts rules.ts permissions.ts tasks.ts graph.ts health.ts
  knowledge/           # graph-ingest, mgraph, chunker, parsers
  scheduler/           # cron engine + executor
  types/fastify.ts     # AuthFastifyInstance (decorate authenticate)
```

---

## Rotas

Registradas em `server.ts` (prefixos):

| Prefixo | Domínio |
|---|---|
| `/health` | Health check |
| `/api` | Knowledge (ingest/search) + Memory |
| `/chat` | Chat streaming (SSE) + sessões |
| `/scheduler` | Tarefas cron |
| `/harness` | Sprints/rounds |
| `/pipeline` | BuildPlan multi-fase |
| `/enrich` | Validator→Enricher + WorkflowRun |
| `/voice` | STT/TTS |
| `/mcp` | Lifecycle MCP servers |
| `/pty` | Terminal interativo (WebSocket) |
| `/telegram` | Bridge Telegram |
| `/vault` | Segredos (keytar) |
| `/usage` | Analytics de tokens |
| `/logs` | Live-tail |
| `/rules` | Regras globais |
| `/permissions` | Whitelist/blacklist + audit |
| `/tasks` | Tasks (kanban CRUD) |
| `/graph` | Knowledge graph (ingest + neighborhood) |

---

## Auth

Plugin `authPlugin` (`fastify-plugin`) decora `server.authenticate`:

1. Lê `Authorization: Bearer <jwt>`.
2. Valida via **JWKS remoto** (`createRemoteJWKSet` de `JWKS_URL` — cacheia/refetch automático), issuer `wolfkrow`, audience `wolfkrow-worker`.
3. Em caso de sucesso, popula `request.user = { userId: payload.sub }`.

Rotas protegidas usam `onRequest: [server.authenticate]`. **Não há fallback de userId** — sem token válido → 401. Isso garante isolamento multi-tenant (cada usuário só vê seus dados).

---

## MCPs / Providers / Secrets

- **MCPs**: ciclo de vida (spawn/stop/restart) + catalog de 18 servers (Google, ElevenLabs, Excalidraw, YouTube, Shopify, Knowledge, Memory, etc).
- **AI providers** (`packages/infra/ai-providers`): Anthropic, Claude-agent, Claude-compat, Codex, Lion + factory + mock.
- **Secrets**: `keytar` (keychain do SO) via `packages/infra/secrets`. Valores nunca vão ao DB ou logs. Mesmo keytar guarda o keypair JWT.
