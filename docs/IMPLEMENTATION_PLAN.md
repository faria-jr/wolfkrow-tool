# Wolfkrow Tool — Implementation Plan (v2)

> Replanejamento completo do refactor LionClaw v3.0 → Wolfkrow Tool.
> Objetivo: **paridade funcional 100% (as-is)** com LionClaw, rodando em **Next.js 15**, sob
> **Clean Architecture, Clean Code, DRY, TDD, SOLID, sem god classes e sem funções acima dos limites de complexidade**.
>
> Versão: 2.0 · Data: 2026-06-20 · Substitui o plano horizontal de 18 fases.

---

## 0. Por que este replanejamento

O plano v1 (18 fases horizontais) tinha 3 falhas estruturais:

1. **Empurrava testes para a Fase 13 (dia 93+)** — viola TDD ("teste antes"). Refactor de 100k+ linhas sem testes em paralelo = regressão garantida.
2. **Camadas Clean Arch (`domain`, `use-cases`) só apareciam na Fase 4** — risco de a lógica vazar para Worker/Route Handlers antes da fundação existir (foi como o LionClaw degenerou em god objects de 5000 linhas).
3. **Afirmava "100% preservado" mas tinha gaps reais** — Rules page perdida, Workflow órfão, Graph rebaixado, 13 superfícies sem SPEC.

Este plano v2 corrige isso com:

- **Fatias verticais por feature** (SPEC → testes RED → domain → use-case → infra → worker → web → E2E GREEN). Cada feature entra "Done" de verdade, com testes.
- **Fundação Clean Arch + guard-rails de qualidade ANTES de qualquer feature** (Fase F).
- **Matriz de rastreabilidade** das 55 funcionalidades (ver [FEATURE_MATRIX.md](./FEATURE_MATRIX.md)).
- **Gaps fechados**: Rules, Graph, Workflow, Enrich, Usage/Logs/Permissions/Tasks/Channels com SPEC.
- **Migrador de dados** `.lionclaw → .wolfkrow` (usuários atuais não perdem histórico).
- **Otimizações** integradas em cada fatia (não como fase final isolada).

---

## 1. Princípios de Engenharia (invioláveis)

### 1.1 Clean Architecture — regra de dependência

```
Presentation (apps/web, apps/worker rotas)  ─┐
                                              ├─► Application (packages/use-cases)
Infrastructure (packages/infra)  ────────────┤        │
                                              │        ▼
                                              └─► Domain (packages/domain)  ◄── não depende de NADA
```

- `domain`: entidades, value objects, domain services, **interfaces de repositório (ports)**, domain events. Zero deps (só Zod leve). Testável sem mocks.
- `use-cases`: 1 caso de uso = 1 classe = 1 verbo. Recebe ports via DI. Orquestra domain + repos.
- `infra`: adapters (Drizzle repos, AI providers, keytar, doc parsers, external APIs). Implementa os ports.
- `presentation`: Next.js (web) + Fastify routes (worker). Só chama use-cases via container DI.

### 1.2 Clean Code / limites de complexidade — **enforced via ESLint desde o commit 1**

```js
// eslint.config.mjs — regras OBRIGATÓRIAS (bloqueiam CI)
rules: {
  'max-lines-per-function': ['error', { max: 50, skipComments: true, skipBlankLines: true }],
  'max-lines':              ['error', { max: 300, skipComments: true }],
  'max-params':             ['error', { max: 4 }],
  'complexity':             ['error', { max: 10 }],
  'max-depth':              ['error', { max: 3 }],
  'max-nested-callbacks':   ['error', { max: 3 }],
  'sonarjs/cognitive-complexity': ['error', 15],   // eslint-plugin-sonarjs
  '@typescript-eslint/no-explicit-any':      'error',
  '@typescript-eslint/no-floating-promises':  'error',
  '@typescript-eslint/consistent-type-imports': 'error',
  'import/order': ['error', { 'newlines-between': 'always', alphabetize: { order: 'asc' } }],
}
```

**Definição de god class neste projeto**: arquivo > 300 linhas OU classe com > 1 responsabilidade. Bloqueado por lint.

### 1.3 TDD — RED → GREEN → REFACTOR por fatia

Toda fatia segue: escrever teste que falha → implementar mínimo → refatorar verde.
Coverage gates (CI bloqueia abaixo): `domain ≥95%`, `use-cases ≥90%`, `infra ≥85%`, `web components ≥70%` (≥80% auth/voice/pagamento), `worker ≥85%`.

### 1.4 DRY

Zod = single source of truth (`z.infer`). shadcn substitui custom. Design tokens únicos. Seed agents em YAML com loader único. Repos com interface comum + base genérica.

### 1.5 SOLID — aplicação concreta

| | Aplicação |
|---|---|
| **S** | 1 use-case = 1 verbo. 1 componente React = 1 responsabilidade. |
| **O** | Strategy `AIProvider` — novo SDK = nova classe, zero edição. |
| **L** | `XxxRepo` (port) → `DrizzleXxxRepo` / `InMemoryXxxRepo` intercambiáveis. |
| **I** | Ports segregados (`AgentRepo`, `SessionRepo`...), nunca uma `Repo` gorda. |
| **D** | DI container (Inversify/tsyringe). Domain nunca conhece Drizzle/HTTP/React. |

---

## 2. Arquitetura-alvo (3 processos)

```
Browser (Next 15 RSC+Client · shadcn · Zustand+TanStack Query · Web Audio · PWA SW)
   │  HTTP · SSE · WebSocket
Next.js 15 server (Route Handlers · Server Actions · middleware auth/rate-limit · Drizzle→SQLite read)
   │  HTTP · WS interno (:4000, JWT ES256 compartilhado via JWKS)
Worker Node long-running (:4000)
   ├─ ai/ (claude-agent · claude-compat · codex · lion + 14 executors · orchestrator)
   ├─ mcp/ (manager spawn 18 MCPs · bridge JSON-RPC stdio · catalog)
   ├─ voice/ pty/ scheduler/ telegram/ dreaming/ memory/ harness/ pipeline/ enrich/ knowledge/ secrets/
   └─ spawns: 18 MCPs · whisper.cpp · ffmpeg · codex CLI · node-pty
Electron wrapper (~300 linhas): systray · hotkey · auto-launch · spawna Next+Worker
Sidecar (apps/sidecar): Open Design Studio (Next.js independente)
```

> **ADR-0026 (NOVO, P0)**: documentar a escolha do Cenário A (Worker) vs Cenário B (Next como renderer
> no Electron, recomendado na análise original). Registrar trade-offs: A habilita PWA/web mas adiciona
> sistema distribuído + proxy SSE/WS + riscos de firewall/throttling; B preserva tudo com menos partes
> móveis mas amarra ao Electron. Decisão deve estar escrita, não implícita.

---

## 3. Estado Atual (auditoria — 2026-06-20)

> **ATUALIZAÇÃO 2026-06-25**: o snapshot abaixo (§3.1–§3.4) é a baseline de pré-remediação
> registrada em 2026-06-20. **Está defasado como indicador de progresso.** Desde então foram
> concluídos: toda a Fase F (Clean Arch, ports, DI, guard-rails), Fase A (auth real + chat
> streaming), o núcleo M2 (agents/skills/MCP/knowledge/memory/dreaming/scheduler), M3–M4
> (voice/PTY/telegram/enrich/pipeline/usage/logs/permissions/rules/tasks/graph/design),
> o audit-remediation Sprint 1-2 (P0 gates + P1 quality) e o Sprint 3-7 (P2 frontend
> P2-1..P2-9, FE-4/FE-7, security sweeps em todas as rotas user-scoped + IDOR fix, P3-2/P3-4).
> O progresso **real atual** está em [FEATURE_MATRIX.md](./FEATURE_MATRIX.md) (~48/55 ✅).
> Permanecem: refactors FE-1/FE-2/FE-3/FE-5/FE-6, P3-1 (e2e rewrite), P3-6 (RAG rerank parity),
> sidecar auth hardening e server-side settings store.
>
> _Snapshot original preservado abaixo para rastreabilidade histórica — não o use como
> indicador de progresso atual._

Progresso real ≈ **5%** (M0 quase completo, M1 parcial). 2 commits. _(baseline 2026-06-20 — ver atualização acima)_

### 3.1 Implementado e aproveitável

| Área | Estado | Nota |
|---|---|---|
| Monorepo (turbo, pnpm, husky, commitlint, prettier) | ✅ | OK |
| `eslint.config.mjs` | ⚠️ | **mínimo — faltam regras de complexidade (§1.2)** |
| `packages/shared-types` | ✅ | 20 schemas Zod + events (domain/SSE) + errors. Boa base. |
| `packages/infra/db/schema` | ✅ | 19 schemas Drizzle (40+ tabelas) + seed + migrate |
| `packages/infra/ai-providers` | ⚠️ | só `anthropic`, **interface só `complete()` (sem streaming)**, factory só 1 provider |
| `packages/infra/repos` | ⚠️ | só helper de scheduler — **sem ports, sem DI, sem base genérica** |
| `packages/infra/auth/jwt` | ✅ | ES256 + JWKS (bom), mas ver bug do login abaixo |
| `apps/worker` | ⚠️ | scaffold Fastify + swagger + scheduler (DI ✅) + mcp manager (spawn, **sem bridge JSON-RPC**) + rotas placeholder |
| `apps/web` | ⚠️ | só `/login` + `/chat` (placeholder) + 35 componentes `ui` shadcn |
| `packages/design-tokens` | ✅ | colors/spacing/typography/tokens.css |

### 3.2 Bugs/placeholders a corrigir (entram como tarefas)

| # | Local | Problema | Prioridade |
|---|---|---|---|
| B1 | `apps/web/app/api/auth/login/route.ts` | keypair JWT **efêmero em memória** (`let keyPair`) — não persiste, worker não valida tokens do web; senha **fake** (`length<8`), sem bcrypt, sem user no DB | **P0** |
| B2 | `apps/worker/src/routes/chat.ts` | retorna texto fixo, sem IA real | P0 |
| B3 | `packages/infra/ai-providers/types.ts` | `AIProvider` sem streaming (`AsyncIterable`) — chat exige | P0 |
| B4 | `apps/worker/src/agent-executor.ts` | regra de negócio no executor (deve ser use-case `RunScheduledTask`) | P1 |
| B5 | `apps/worker/src/mcp/manager.ts` | spawn sem **bridge JSON-RPC stdio** nem health real (timeout fixo 500ms) | P1 |
| B6 | `packages/infra/repos` | sem interfaces (ports) nem base — viola Clean Arch/LSP | P0 |

### 3.3 Não existe (a criar)

`packages/domain`, `packages/use-cases`, `apps/sidecar`, `apps/wrapper`, container DI, doc-parsers, voice, pty, telegram, dreaming, memory, harness, pipeline, enrich, knowledge, seed-agents loader, migrador de dados.

### 3.4 Gaps adicionais — auditoria profunda (a corrigir/reimplementar)

Achados ao ler o código linha-a-linha. Cada um vira tarefa na fase indicada.

| # | Local | Gap | Severidade | Corrige em |
|---|---|---|---|---|
| G1 | `apps/web/` (sem `middleware.ts`) + `app/(app)/layout.tsx` | **Sem auth-gate**: layout autenticado não verifica sessão — qualquer um acessa `(app)/*`. Falha de segurança. | **P0** | A.1 (middleware auth + redirect /login) |
| G2 | `apps/worker/src/plugins/auth.ts` | JWKS buscado de `http://localhost:3000/api/auth/login` (GET) — **keypair efêmero** (B1). Web restart → todos tokens inválidos. URL hardcoded. | **P0** | F.4 (keypair persistente + endpoint JWKS dedicado `/.well-known/jwks.json`) |
| G3 | `packages/infra/ai-providers/anthropic.ts` | Só `complete()` não-streaming, sem `query()`/`countTokens()`. Chat exige streaming. | **P0** | F.4 + A.2 (redesenho interface + provider streaming) |
| G4 | `apps/worker/src/agent-executor.ts` | Regra de negócio no executor (carrega agent, keytar, chama provider). Deve ser use-case `RunScheduledTask`. | P1 | N.6 |
| G5 | `apps/worker/src/index.ts` `main()` | Start de MCPs **sequencial com await** (≤18× ~500ms) **antes** do HTTP subir → boot lento + falha de 1 MCP atrasa server. | P1 | N.3 (subir HTTP primeiro, MCPs async + supervisor) |
| G6 | `packages/infra/db/schema/*.ts` | **Zero índices** definidos (ex: `chat_messages.sessionId`, `chat_sessions.userId/lastActivity`, `archived`). Queries de lista → table-scan. | P1 | F.4/cada fase (adicionar `index()` por schema ao criar repo) |
| G7 | `apps/worker/src/mcp/manager.ts` | Health = timeout fixo 500ms, sem **handshake JSON-RPC** real; `restart` recursivo sem backoff (loop em crash rápido). | P1 | N.3 |
| G8 | `apps/web/package.json` | Não referencia `@wolfkrow/domain`/`@wolfkrow/use-cases` (não existem) — UI acabaria chamando infra/worker direto, furando Clean Arch. | **P0** | F.2/F.3 (criar packages + wire deps) |
| G9 | MCP catalog (`built-in-mcps.ts`) | Aponta comandos dos 18 MCP servers que **ainda não foram migrados** do LionClaw (`mcp-servers/`). Start falha hoje. | P1 | N.3 (migrar pacotes MCP → `apps/worker/src/mcp-servers/` ou `packages/mcp-servers/`) |

**Reimplementações obrigatórias** (não só correção pontual):
- **Auth completa** (G1+G2+B1): a cadeia atual (login fake + keypair efêmero + sem gate + worker confiando em JWKS efêmero) deve ser **reimplementada do zero** na Fase A.1/F.4, não remendada.
- **AIProvider** (G3+B3): interface reescrita para streaming antes de qualquer provider novo.
- **MCP manager** (G5+G7+G9): reimplementar com bridge JSON-RPC + supervisor + migração dos pacotes.

---

## 4. Roadmap por Fases (fatias verticais)

> Estimativa: **170 dias úteis / 1 dev** (escopo real ~100k LOC densa + testes). 2 devs ≈ 3.5 meses, 3 devs ≈ 2.5 meses.
> Cada fatia só fecha "Done" com: SPEC + testes (gates) + lint verde + typecheck + sem god class.

### Marcos

| Marco | Dia | Entregável validável |
|---|---|---|
| **M0** | 5 | Fundação Clean Arch + guard-rails de qualidade + DI + ports (Fase F) |
| **M1** | 28 | Vertical Auth + Chat streaming real end-to-end (4 SDKs strategy) |
| **M2** | 70 | Núcleo: Agents, Skills, MCP (bridge real), Knowledge, Memory, Dreaming, Scheduler |
| **M3** | 105 | Automação: Harness, Pipeline, Enrich, Workflow, Voice, PTY/CodeBurn, Telegram |
| **M4** | 130 | Superfícies restantes: Vault, Usage, Logs, Permissions, Rules, Channels, Tasks, Graph, Open Design |
| **M5** | 150 | Wrapper Electron + PWA + migrador de dados + distribuição |
| **M6** | 170 | Hardening, otimizações, E2E completo, beta, v1.0 |

---

### Fase F — Fundação (M0, dias 1–5) · **pré-requisito de tudo**

Sem feature nova. Funda a casa antes de mobiliar.

**F.1 Guard-rails de qualidade (dia 1)**
- [ ] Reescrever `eslint.config.mjs` com regras de complexidade §1.2 + `eslint-plugin-sonarjs`.
- [ ] CI: job que falha se `max-lines`/`complexity`/`cognitive-complexity` estourar.
- [ ] CI: coverage gates por package (§1.3) via `vitest --coverage` + thresholds.
- [ ] `turbo.json`: pipeline `test`, `test:cov`, `lint`, `typecheck` com cache.

**F.2 `packages/domain` (dias 2–3)**
- [ ] Estrutura `entities/ value-objects/ services/ events/ repos/(ports)`.
- [ ] Value objects base: `Id`, `ModelId`, `ToolName`, `CronExpression`, `EmbeddingVector`, `Timestamp`.
- [ ] Erros tipados base (`DomainError`, `NotFoundError`, `ValidationError`).
- [ ] Domain events + `EventBus` interface.
- [ ] Testes ≥95% (entidades/VOs são puras — sem mocks).

**F.3 `packages/use-cases` + DI (dias 3–4)**
- [ ] Scaffold + container Inversify (`packages/use-cases/src/container.ts`).
- [ ] Convenção `UseCase<Input, Output>` + `execute()`.
- [ ] `packages/infra/repos`: **ports → base genérica `DrizzleRepo<T>` + `InMemoryRepo<T>`** (DRY/LSP).
- [ ] Tokens DI registrados (repos, providers, eventBus, logger).

**F.4 Streaming + auth corretos (dias 4–5)** — corrige B1, B3, B6, G2, G3, G6, G8
- [ ] Redesenhar `AIProvider`: `query(prompt, opts): AsyncIterable<StreamChunk>` + `complete()` + `countTokens()` (G3/B3).
- [ ] JWT: **keypair ES256 persistido** em keytar (não em memória); endpoint dedicado `/.well-known/jwks.json` (não o GET do login). Corrige B1/G2.
- [ ] Worker valida JWT via JWKS estável (URL por config, não hardcoded).
- [ ] Helper `index()` por schema + adicionar índices faltantes (G6): `chat_messages.sessionId`, `chat_sessions.userId/lastActivity/archived`, FKs quentes.
- [ ] `apps/web` e `apps/worker` declaram deps `@wolfkrow/domain` + `@wolfkrow/use-cases` (G8) — UI nunca importa infra direto.

**Done F**: `domain` e `use-cases` existem, DI funciona, lint de complexidade bloqueia CI, AIProvider streaming, auth com keypair persistente. Coverage domain ≥95%.

---

### Fase A — Auth + Chat (M1, dias 6–28)

Fatia vertical de ponta a ponta — prova a arquitetura inteira.

**A.1 Auth real (dias 6–11)** — SPEC-001 · **reimplementação** (corrige B1, G1, G2)
- [ ] Domain: `User`, `Session`, VO `PasswordHash`, service `TotpVerifier`, `LockoutPolicy`.
- [ ] Use-cases: `Register`, `Login` (bcrypt real, user no DB — substitui o login fake), `VerifyTotp`, `LockSession`, `UnlockSession`.
- [ ] Infra: `DrizzleUserRepo`, `BcryptHasher`, `OtplibTotp`, keytar p/ keypair.
- [ ] Web: `(auth)/login`, `/onboarding` (wizard senha→SDK), `/unlock`.
- [ ] **`apps/web/middleware.ts`** (G1): auth-gate em todas as rotas `(app)/*` → redirect `/login` se sem sessão válida; rate-limit (10/min login).
- [ ] `(app)/layout.tsx`: validar sessão server-side (defesa em profundidade além do middleware).
- [ ] Auto-lock: idle >5min OU tab hidden OU (wrapper) sleep/lid.
- [ ] Lockout: 5 tentativas → 5min.
- [ ] Testes: unit (use-cases ≥90%), component (≥80% auth), E2E `auth.spec.ts`.

**A.2 AI Providers strategy — 4 SDKs (dias 12–19)** — corrige B2
- [ ] `packages/infra/ai-providers/`: `claude-agent`, `claude-compat`, `codex`, `lion` + `factory` + `mock`.
- [ ] `lion-sdk`: portar 8 adapters + 9 tools (multi-provider Ollama/OpenAI/Google/Z.ai/custom) → cada adapter ≤300 linhas.
- [ ] `agent-runtime`: 14 executors → strategy (`cloud/local/codex/external/zai/google-genai/...`), 1 arquivo cada.
- [ ] `orchestrator` (worker): message-queue + permission guard + seleção de strategy.
- [ ] Testes: cada provider ≥85% com mock de SDK.

**A.3 Chat streaming real (dias 20–28)** — SPEC-002
- [ ] Domain: `Message`, `Attachment`, `ChatSession`, service `TokenEstimator`, `CompactionTrigger`.
- [ ] Use-cases: `SendMessage` (AsyncIterable), `StreamMessage`, `CompactSession`, `GenerateTitle`, `ArchiveSession`.
- [ ] Worker: `/chat/send` SSE real → orchestrator → provider stream → persist parcial + eventos.
- [ ] Web Route Handler `/api/chat/stream` proxy SSE → Worker; `lib/sse/useChatStream` com **reconnect (backoff)** + abort.
- [ ] Componentes (shadcn): `ChatView`, `ChatMessage` (markdown+highlight), `ToolCallInline` (colapsável), `TokenCounter`, `SlashCommandPicker` (cmdk), `ConfirmDialog` (AlertDialog), `AskQuestionDialog`, `ArtifactRenderer` (artifact detection), `StreamIndicator`.
- [ ] Botão Stop (abort imediato). Attachments (img/PDF/code).
- [ ] **Otimização**: virtualization (`react-window`) no histórico; Suspense boundaries; RSC para lista de sessões.
- [ ] Testes: use-cases ≥90%, component ≥70%, E2E `chat.spec.ts` (send, stream, tool call, stop).

**Done M1**: login real + chat streaming com 4 SDKs selecionáveis, tudo testado. Demo end-to-end.

---

### Fase N — Núcleo (M2, dias 29–70)

**N.1 Sub-Agents (dias 29–35)** — SPEC-013 (novo)
- [ ] Domain `Agent` (model, effort, thinking+budget, maxTurns, tools, mcps, skills, runtime, squad, systemPrompt).
- [ ] Use-cases: `CreateAgent`, `UpdateAgent`, `DeleteAgent`, `DuplicateAgent`, `ListAgents`, `SyncAgentsToOrchestrator`.
- [ ] Web: `agents/` + `AgentFormModal` **refatorado** (LionClaw tinha 1765 linhas → shadcn Form + react-hook-form, alvo ≤300), `AgentList` (DataTable), `SyncAgentsModal`, `DeleteAgentDialog`.
- [ ] Testes + E2E `agents.spec.ts`.

**N.2 Skills + Seed-agents YAML (dias 36–40)** — SPEC-014 (novo)
- [ ] Domain `Skill` (frontmatter validado por Zod).
- [ ] Use-cases CRUD + `AttachSkillToAgent`.
- [ ] **Seed-agents loader**: 67 `.ts` (9610 linhas) → `.wolfkrow/agents/*.yaml` + loader único + validator Zod (DRY, −80% linhas). Smoke test por agent.
- [ ] Web: `skills/` + `SkillEditor` (markdown+frontmatter preview).
- [ ] Testes + smoke.

**N.3 MCP Manager real (dias 41–48)** — SPEC-008 · **reimplementação** (corrige B5, G5, G7, G9)
- [ ] **Migrar os 18 MCP servers** do LionClaw `mcp-servers/` → `packages/mcp-servers/` (versionados) — hoje o catalog aponta comandos inexistentes (G9).
- [ ] **Bridge JSON-RPC stdio** real (handshake, tools/list, tools/call, notificações) — substitui spawn-cego (G7).
- [ ] Health check via handshake (não timeout fixo 500ms); **auto-reconnect com backoff** (não recursão imediata — evita loop em crash, G7).
- [ ] Boot: **subir HTTP primeiro**, iniciar MCPs `always` de forma assíncrona com supervisor (G5).
- [ ] Catalog dos 18 MCPs + CRUD custom + visibility (always/on-demand).
- [ ] Web: `mcp/` + `MCPList` (DataTable) + `MCPForm` + start/stop/restart.
- [ ] Testes (MCP mock) + E2E `mcp.spec.ts`.

**N.4 Knowledge / RAG (dias 48–58)** — SPEC-004
- [ ] Domain: `Document`, `Chunk`, service `SemanticChunker`, `RetrievalScorer`.
- [ ] Infra doc-parsers (≤300 linhas cada): `pdf`, `docx`, `csv`, `xlsx`, `md`, `url(readability)`; embeddings Anthropic; `sqlite-vec` repo (hybrid search).
- [ ] Use-cases: `IngestDocument`, `SearchKnowledge`, `RunBenchmark`.
- [ ] Worker: ingest pipeline (parse→chunk→embed→store), batches de 100.
- [ ] Web: `knowledge/` + `UploadDropZone` + `DocumentList` (DataTable) + `SearchPanel` + citações inline.
- [ ] **Otimização**: parsing em Web Worker/worker-thread (não bloquear); IVF index se >10k chunks; streaming SSR da lista.
- [ ] Testes + E2E `knowledge.spec.ts`.

**N.5 Memory + Dreaming (dias 59–65)** — SPEC-015 (novo)
- [ ] Domain: `SemanticMemory`, `DailySummary`, `CompactionLog`, service `CompactionPolicy`.
- [ ] Use-cases: `CompactSession`, `ConsolidateMemory`, `GenerateDailySummary`, `SearchMemory`.
- [ ] Worker: `memory/pipeline` + `dreaming/gate`+`turn-engine` (idle>5min, pausa no retorno).
- [ ] Web: `memory/` (gerência + trigger manual + logs).
- [ ] Testes (≥90% use-cases).

**N.6 Scheduler + Tasks (dias 66–70)** — SPEC-009 · corrige B4
- [ ] Use-case `RunScheduledTask` (tira lógica do `agent-executor`).
- [ ] Domain `ScheduledTask`, `TaskRun`, VO `CronExpression`, review (validated/rejected).
- [ ] Web: `scheduler/` (cron editor+preview, kanban dnd-kit, calendar react-day-picker) + `tasks/`.
- [ ] Testes + E2E `scheduler.spec.ts`.

**Done M2**: agents, skills, MCP real, knowledge, memory, dreaming, scheduler — todos testados.

---

### Fase B — Automação (M3, dias 71–105)

**B.1 Harness (dias 71–80)** — SPEC-005
- [ ] Domain: `HarnessProject`, `Sprint`, `Round`, service `AcceptanceEvaluator`, `RoundMetrics`.
- [ ] Use-cases: `StartHarness`, `PlanSprints`, `RunCoderRound`, `EvaluateRound` (retry≤5).
- [ ] Worker: `harness/engine|planner|evaluator|prompts` (LionClaw `harness-engine` 2422 linhas → módulos ≤300).
- [ ] Web: `harness/` + `ProjectList` + `ExecutionView` (SSE rounds) + `MetricsView` (recharts) + diff viz.
- [ ] Testes + E2E `harness.spec.ts`.

**B.2 Pipeline (BuildPlan) (dias 81–88)** — SPEC-006
- [ ] Domain: `PipelineProject`, `Phase`, transições discovery→spec→validate→approval→implementation.
- [ ] Use-cases por fase + `ApprovePhase` (approve/reject/edit).
- [ ] Worker `pipeline/engine` + shared (LionClaw store 1886 linhas → 4 stores + use-cases).
- [ ] Web: `pipeline/` + `PipelineChatView` + `SprintExecutionView` (1643→≤500) + `PipelineMetricsReport` (1647→≤600 com DataTable+Chart).
- [ ] Testes + E2E `pipeline.spec.ts`.

**B.3 Enrich + Workflow (dias 89–93)** — SPEC-016 (novo) · fecha gaps
- [ ] Enrich: domain `EnrichSession`, use-cases `Validate`→`Enrich`; worker `enrich/engine`; web modal (parallel routes).
- [ ] **Workflow** (era schema órfão): decidir vivo → domain `WorkflowRun` + use-cases + UI mínima; OU remover schema se morto (decisão registrada em ADR).
- [ ] Testes.

**B.4 Voice (dias 94–100)** — SPEC-003
- [ ] Worker `voice/`: `whisper` (local), `elevenlabs` (HTTP), `cartesia` (WS), `streaming-tts`.
- [ ] Web: `useVoiceConversation` (LionClaw 1310 linhas → hooks menores: `useVad`, `useStt`, `useTts`, `useBargeIn`); `VoiceOrb`, `VoiceRecorder`, `AudioPlayer`.
- [ ] **Otimização**: lazy-load engine de voz (~1.3MB) só ao abrir panel.
- [ ] Testes (mocks) + E2E `voice.spec.ts`.

**B.5 PTY/CodeBurn + Telegram (dias 101–105)** — SPEC-010 + SPEC-017 (novo PTY)
- [ ] Worker `pty/server` (node-pty + WS bridge) → Next WS proxy → xterm.js.
- [ ] Telegram `bridge` (polling, pairing 6 dígitos, commands, attachments).
- [ ] Web: terminal (xterm) + `channels/TelegramSetup`.
- [ ] Testes + E2E.

**Done M3**: toda automação + voz + terminal + telegram, testados.

---

### Fase S — Superfícies restantes (M4, dias 106–130) · **fecha todos os gaps**

**S.1 Vault (dias 106–108)** — SPEC-011
- [ ] Domain `Secret` (metadata); infra keytar (values nunca no DB/log); use-cases CRUD + export/import encrypted.
- [ ] Web `vault/` (mascarado, últimos 4 chars). Testes.

**S.2 Usage + Pricing (dias 109–112)** — SPEC-018 (novo)
- [ ] Domain service `PricingCalculator` (anthropic/openai/vertex/custom), VO `PricingTier`.
- [ ] Use-case `ComputeUsage`; web `usage/` (recharts) + **budget alerts** (otimização nova) + token analytics.
- [ ] Testes.

**S.3 Logs + Permissions + Rules (dias 113–120)** — SPEC-019, SPEC-020, SPEC-021 (novos) · **Rules era a feature PERDIDA**
- [ ] Logs: worker SSE live-tail + web `logs/` (filtros).
- [ ] Permissions: domain `PermissionResolver` (allow/deny/ask), whitelist/blacklist tools; web `permissions/`.
- [ ] **Rules page** (gap fechado): domain `GlobalRule`, CRUD, editor; injeção no prompt-builder; web `rules/`.
- [ ] Testes.

**S.4 Channels + Tasks polish (dias 121–123)**
- [ ] `channels/` (gerência Telegram/futuros). `tasks/` finalizado. Testes.

**S.5 Graph view (dias 124–127)** — SPEC-022 (novo) · gap fechado
- [ ] Worker `knowledge/graph-ingest`+`mgraph` (LionClaw 1613+1130 linhas → módulos ≤300).
- [ ] Web `graph/` página dedicada + `GraphCanvas` (D3 force layout navegável — **otimização**: substitui mgraph estático).
- [ ] Testes.

**S.6 Open Design sidecar (dias 128–130)** — SPEC-007
- [ ] `apps/sidecar/` (Next.js independente, porta 5000); worker gerencia lifecycle; web embute via iframe; auth cross-origin via worker proxy.
- [ ] Mover `vendor/open-design` (106MB) → `apps/sidecar` + `packages/design-tools` (versionado, fora do git LFS).
- [ ] Testes E2E.

**Done M4**: **paridade 100%** com LionClaw. Matriz de features toda ✅.

---

### Fase D — Distribuição (M5, dias 131–150)

**D.1 Migrador de dados (dias 131–135)** — **NOVO, crítico p/ usuários atuais**
- [ ] `scripts/migrate-lionclaw.ts`: `.lionclaw/*.db` (78 migrations, 41 tabelas) → schema Drizzle Wolfkrow.
- [ ] Mapear tabela-a-tabela; preservar sessions, messages, agents, knowledge, memory, secrets metadata.
- [ ] Dry-run + relatório + rollback. Testes com DB real LionClaw de fixture.

**D.2 Electron wrapper (dias 136–139)** — SPEC-012
- [ ] `apps/wrapper` (~300 linhas): spawna Next+Worker, BrowserWindow, systray (Open/Quick Chat/Lock/Quit), hotkey global (Cmd+Shift+Space), auto-launch.
- [ ] `sandbox: true`, context isolation, sem node integration.
- [ ] Auto-update (electron-updater) channels stable/beta.

**D.3 PWA (dias 140–142)** — ADR-0019
- [ ] manifest + ícones + Service Worker (Serwist): offline shell, NetworkFirst API, CacheFirst assets, shortcuts.
- [ ] Lighthouse PWA ≥95.

**D.4 Build + assinatura (dias 143–150)**
- [ ] electron-builder: DMG (x64+arm64), NSIS, AppImage; notarization mac; signing.
- [ ] CI release: tag → 3 OS artifacts; Turborepo remote cache; Codecov.

**Done M5**: instaláveis assinados + migração de dados + PWA.

---

### Fase H — Hardening + Otimização + Beta (M6, dias 151–170)

**H.1 Otimizações finais (dias 151–158)**
- [ ] Bundle: `@next/bundle-analyzer`, dynamic imports por rota, tree-shake shadcn, alvo initial <300KB.
- [ ] RSC ≥70% das pages; PPR experimental; `use cache` p/ dados estáticos (agents/skills).
- [ ] TanStack Query: stale 5min / gc 30min; prefetch-on-hover.
- [ ] SQLite: índices (EXPLAIN), WAL, prepared statements (Drizzle), batch inserts.
- [ ] Métricas alvo: Lighthouse Perf ≥95, TTFB <200ms, LCP <1.5s, TTI <2.5s, TTFT <500ms.

**H.2 Segurança (dias 159–162)**
- [ ] Zod validation em **todos** os Route Handlers + rotas Worker (runtime).
- [ ] CSP via Next headers; CSRF tokens em Server Actions; SameSite cookies.
- [ ] Pino redact (secrets nunca em log); correlation-id em todas requests.
- [ ] `pnpm audit` em CI; rate-limit por rota sensível.

**H.3 Testes finais + Beta (dias 163–170)**
- [ ] Auditoria de coverage (preencher gaps até gates).
- [ ] E2E completo Chrome+Firefox+Edge; visual regression (Playwright snapshots); a11y (axe-core).
- [ ] Beta fechado (5 testers) + bug bash; docs (`MIGRATION_FROM_LIONCLAW.md`, USER_GUIDE, Storybook).
- [ ] Tag `v1.0.0` + GitHub Release.

---

## 5. Otimizações & Melhorias identificadas (consolidado)

Integradas nas fases acima; aqui o índice para rastreio.

| # | Melhoria | Onde | Ganho |
|---|---|---|---|
| O1 | Streaming SSR + RSC ≥70% pages | H.1 | Bundle −40%, TTFB ↓ |
| O2 | Code-splitting por rota + tree-shake shadcn | H.1 | FCP −60%, TTI −50% |
| O3 | TanStack Query cache + prefetch-on-hover | A.3/H.1 | Navegação instantânea |
| O4 | Parsing PDF/DOCX em worker-thread | N.4 | UI não trava |
| O5 | sqlite-vec IVF index >10k chunks | N.4 | Search −50% |
| O6 | Lazy-load voice engine (1.3MB) | B.4 | Initial bundle −10% |
| O7 | Virtualization histórico chat | A.3 | Scroll fluido |
| O8 | Graph navegável D3 (substitui mgraph estático) | S.5 | Discovery de conexões |
| O9 | Budget alerts por agent/período | S.2 | Controle de custo |
| O10 | Seed-agents YAML (loader único) | N.2 | −80% linhas, DRY |
| O11 | Migrador de dados LionClaw | D.1 | Zero perda p/ usuários atuais |
| O12 | Zod runtime em todo IPC/HTTP | H.2 | Elimina classe de bugs/inseguro |
| O13 | Drizzle prepared statements | H.1 | Sem SQL injection, perf = raw |
| O14 | Correlation-id + Pino estruturado | H.2 | Observabilidade |
| O15 | Storybook + visual regression | H.3 | Regressão visual barrada |
| O16 | DI container (Inversify) | F.3 | Testabilidade, DIP |
| O17 | Repo base genérica (`DrizzleRepo<T>`) | F.3 | DRY, menos boilerplate |
| O18 | Domain events + EventBus | F.2 | Desacoplamento use-cases |

Pós-MVP (v1.1+, do PRD): multi-workspace, cloud sync, plugin marketplace, hotkey config, browser extension, inbox-zero Telegram, calendar/email agents, code-review bot, prompt playground.

---

## 6. Rastreabilidade — 55 funcionalidades

Matriz completa feature → SPEC → fase → testes em **[FEATURE_MATRIX.md](./FEATURE_MATRIX.md)**.

SPECs a criar (gaps): SPEC-013 Agents · 014 Skills · 015 Memory/Dreaming · 016 Enrich/Workflow · 017 PTY · 018 Usage/Pricing · 019 Logs · 020 Permissions · 021 Rules · 022 Graph.
ADR a criar: **ADR-0026 Cenário A vs B**.

---

## 7. Definition of Done (por fatia)

- [ ] SPEC escrita/atualizada em `docs/specs/`.
- [ ] Testes escritos ANTES (RED) e passando; coverage no gate da camada.
- [ ] Nenhuma função >50 linhas, nenhum arquivo >300, complexity ≤10, cognitive ≤15 (lint verde).
- [ ] `pnpm typecheck` + `pnpm lint` + `pnpm test` verdes.
- [ ] Sem `any`, sem `TODO`/`FIXME`, sem floating promises.
- [ ] Use-case isolado de infra (DI); domain sem deps externas.
- [ ] E2E do fluxo (quando aplicável) verde em Chrome+Firefox+Edge.
- [ ] Entrada correspondente em FEATURE_MATRIX marcada ✅.

---

## 8. Riscos & Mitigações

| # | Risco | Prob | Impacto | Mitigação |
|---|---|---|---|---|
| 1 | Lógica vazar p/ Worker antes do domain | Alta | Alto | **Fase F antes de qualquer feature**; lint de complexidade desde dia 1 |
| 2 | Lion-SDK (runtime próprio) difícil de portar | Alta | Alto | Strategy isolada (A.2); mock provider; testes ≥85% |
| 3 | Cenário A: SSE em firewall/throttling | Média | Médio | Fallback long-polling; Service Worker; ADR-0026 documenta |
| 4 | Migração de dados corromper histórico | Média | Alto | Dry-run + rollback + fixture real (D.1) |
| 5 | 78 migrations não portam 1:1 | Alta | Médio | Re-derivar Drizzle do zero (schema já existe) + migrador de dados |
| 6 | Cronograma otimista p/ 100k LOC | Média | Alto | Fatias verticais entregam valor incremental; buffer em H |
| 7 | shadcn não cobre custom (VoiceOrb, GraphCanvas) | Baixa | Médio | Mantidos custom, isolados e testados |

---

**Última atualização**: 2026-06-20 · **Próxima revisão**: após M0 (dia 5)
