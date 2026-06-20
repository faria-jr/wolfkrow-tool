# Wolfkrow Tool — Implementation Plan

> Roadmap faseado de 136 dias úteis (~5.5 meses com 1 dev, ~2.5 meses com 3 devs). Cada fase tem deliverables tangíveis e critérios de done.

---

## Resumo Executivo

| Métrica | Valor |
|---|---|
| **Dias úteis totais** | 136 |
| **Fases** | 18 |
| **Marcos principais** | 8 (M0 → M7) |
| **Equipes recomendadas** | 1 (6.5 meses) / 2 (3.5 meses) / 3 (2.5 meses) |
| **Linhas de código** | ~90k TS/TSX reescritas + ~30k novas (testes + boilerplate) |
| **Funcionalidades preservadas** | 100% (zero perda vs LionClaw v3) |
| **Funcionalidades adicionadas** | 20+ (PWA, RSC, Server Actions, TDD completo) |

---

## Marcos (Milestones)

| Marco | Dia | Entregável Validável |
|---|---|---|
| **M0** | 3 | Monorepo rodando, apps/web com Next.js 15 + shadcn, apps/worker scaffolded |
| **M1** | 18 | Fundação completa: shared-types, domain, use-cases, infra (Drizzle), 1 página demo E2E (Chat) |
| **M2** | 36 | Clean Arch completa, 5 páginas migradas, design system aplicado |
| **M3** | 64 | UI 100% migrada (19 páginas), shadcn 100% aplicado |
| **M4** | 76 | Sidecar separado, PWA, wrapper Electron |
| **M5** | 104 | Testes verdes (730+ testes), coverage targets atingidos |
| **M6** | 116 | Beta RC (DMG + NSIS + AppImage) |
| **M7** | 136 | v1.0 público no GitHub Releases |

---

## Fase 0 — Setup Monorepo (3 dias)

**Objetivo**: Criar a fundação do projeto — Turborepo, pnpm workspaces, tooling de qualidade.

### Dia 1 — Inicialização
```bash
# Criar repo local
mkdir wolfkrow-tool && cd wolfkrow-tool
git init
pnpm init

# Instalar Turborepo + tooling
pnpm add -Dw turbo pnpm husky lint-staged @commitlint/cli @commitlint/config-conventional
```

- [ ] `package.json` raiz com workspaces
- [ ] `pnpm-workspace.yaml` definindo `apps/*` e `packages/*`
- [ ] `turbo.json` com pipelines (build, lint, test, typecheck)
- [ ] `.gitignore` comprehensive (node_modules, dist, .next, .wolfkrow)
- [ ] `.editorconfig`
- [ ] `.nvmrc` (node 22)
- [ ] `.npmrc` (auto-install-peers, strict-peer-dependencies)

### Dia 2 — Lint + Format + Hooks
- [ ] `eslint.config.js` (flat config v9) com:
  - `@typescript-eslint/recommended-type-checked`
  - `eslint-plugin-react-hooks`
  - `eslint-plugin-react-refresh`
  - `eslint-plugin-import` (order)
  - Rules custom: `max-lines-per-function: 50`, `max-params: 4`, `complexity: 10`
- [ ] `.prettierrc` (semi: true, singleQuote: true, printWidth: 100)
- [ ] `prettier-plugin-tailwindcss`
- [ ] `.husky/pre-commit`: `pnpm lint-staged`
- [ ] `.husky/commit-msg`: `pnpm commitlint`
- [ ] `lint-staged.config.js`
- [ ] `commitlint.config.js` (conventional commits)

### Dia 3 — CI + Docs Skeleton
- [ ] `.github/workflows/ci.yml`: matrix Node 22, pnpm cache, turbo cache
- [ ] `.github/workflows/release.yml`: tag → DMG/NSIS build
- [ ] `.github/PULL_REQUEST_TEMPLATE.md`
- [ ] `.github/ISSUE_TEMPLATE/{bug,feature}.md`
- [ ] `docs/README.md` apontando para ADR/SPEC
- [ ] `docs/IMPLEMENTATION_PLAN.md` (este arquivo)
- [ ] `docs/PRD.md` (Product Requirements)
- [ ] `docs/ARCHITECTURE.md`
- [ ] `docs/adr/README.md`
- [ ] `docs/specs/README.md`
- [ ] `README.md` raiz
- [ ] `AGENT.md` (guia para AI agents)
- [ ] `LICENSE`

### Critérios de Done
- `pnpm install` roda sem erros
- `pnpm turbo build` succeeds (com packages vazios)
- `pnpm lint` passa
- `pnpm typecheck` passa
- `pnpm test` roda (sem testes ainda, mas funciona)
- Pre-commit hook funciona
- GitHub Actions green

---

## Fase 1 — Setup Next.js + shadcn (3 dias)

**Objetivo**: Criar `apps/web/` com Next.js 15 + Tailwind v4 + shadcn registry.

### Dia 4 — Next.js Scaffold
```bash
pnpm create next-app@latest apps/web --typescript --tailwind --app --src-dir --import-alias '@/*'
pnpm add -F web next@^15 react@^19 react-dom@^19
pnpm add -F web zustand @tanstack/react-query zod
```
- [ ] `apps/web/next.config.ts` com `transpilePackages`
- [ ] `apps/web/tailwind.config.ts` com design tokens
- [ ] `apps/web/app/layout.tsx` root
- [ ] `apps/web/app/page.tsx` redirect to `/chat`
- [ ] `apps/web/app/globals.css` (Tailwind v4 directives)
- [ ] `apps/web/middleware.ts` (placeholder)

### Dia 5 — shadcn Setup
```bash
cd apps/web && pnpm dlx shadcn@latest init
pnpm dlx shadcn@latest add button card input label dialog sheet tabs ...
```
- [ ] `components.json` shadcn config
- [ ] `app/globals.css` com CSS variables (light/dark theme)
- [ ] `components/ui/button.tsx` instalado
- [ ] `components/ui/card.tsx` instalado
- [ ] 49+ componentes shadcn adicionados em batch

### Dia 6 — Design System Foundation
- [ ] `packages/design-tokens/src/colors.ts`
- [ ] `packages/design-tokens/src/typography.ts`
- [ ] `packages/design-tokens/src/spacing.ts`
- [ ] `packages/design-tokens/src/theme.ts`
- [ ] Tailwind config consuming tokens
- [ ] Storybook setup (`apps/web/.storybook/`)
- [ ] Theme toggle (next-themes) integrado
- [ ] First story: Button variants

### Critérios de Done
- `pnpm dev:web` → browser em `localhost:3000` mostra home
- shadcn Button + Card renderizam com theming
- Storybook roda (`pnpm storybook`)
- TypeScript strict passa

---

## Fase 2 — Setup Drizzle + shared-types (5 dias)

**Objetivo**: Criar `packages/shared-types/` (Zod schemas) + `packages/infra/db/` (Drizzle schema).

### Dia 7-8 — Zod Schemas (single source of truth)
- [ ] `packages/shared-types/src/schemas/agent.ts`
- [ ] `packages/shared-types/src/schemas/chat.ts` (session, message, attachment)
- [ ] `packages/shared-types/src/schemas/mcp.ts`
- [ ] `packages/shared-types/src/schemas/skill.ts`
- [ ] `packages/shared-types/src/schemas/scheduler.ts`
- [ ] `packages/shared-types/src/schemas/knowledge.ts` (document, chunk)
- [ ] `packages/shared-types/src/schemas/harness.ts` (project, sprint, round)
- [ ] `packages/shared-types/src/schemas/pipeline.ts`
- [ ] `packages/shared-types/src/schemas/memory.ts`
- [ ] `packages/shared-types/src/schemas/vault.ts`
- [ ] `packages/shared-types/src/schemas/auth.ts`
- [ ] `packages/shared-types/src/schemas/settings.ts`
- [ ] `packages/shared-types/src/schemas/channels.ts`
- [ ] `packages/shared-types/src/schemas/tasks.ts`
- [ ] `packages/shared-types/src/schemas/audit.ts`
- [ ] `packages/shared-types/src/schemas/enrich.ts`
- [ ] `packages/shared-types/src/schemas/usage.ts`
- [ ] `packages/shared-types/src/schemas/workflow.ts`
- [ ] Tests para cada schema (happy + edge cases)

### Dia 9-10 — Drizzle Schema
```bash
pnpm add -F infra drizzle-orm better-sqlite3 sqlite-vec
pnpm add -FD drizzle-kit @types/better-sqlite3
```
- [ ] `packages/infra/src/db/schema/users.ts`
- [ ] `packages/infra/src/db/schema/sessions.ts`
- [ ] `packages/infra/src/db/schema/agents.ts`
- [ ] `packages/infra/src/db/schema/skills.ts`
- [ ] `packages/infra/src/db/schema/mcp-servers.ts`
- [ ] `packages/infra/src/db/schema/chat.ts`
- [ ] `packages/infra/src/db/schema/scheduler.ts`
- [ ] `packages/infra/src/db/schema/knowledge.ts`
- [ ] `packages/infra/src/db/schema/memory.ts`
- [ ] `packages/infra/src/db/schema/harness.ts`
- [ ] `packages/infra/src/db/schema/pipeline.ts`
- [ ] `packages/infra/src/db/schema/enrich.ts`
- [ ] `packages/infra/src/db/schema/vault.ts`
- [ ] `packages/infra/src/db/schema/settings.ts`
- [ ] `packages/infra/src/db/schema/channels.ts`
- [ ] `packages/infra/src/db/schema/tasks.ts`
- [ ] `packages/infra/src/db/schema/audit.ts`
- [ ] `packages/infra/src/db/schema/workflow.ts`
- [ ] `packages/infra/src/db/schema/usage.ts`
- [ ] `packages/infra/src/db/schema/index.ts`
- [ ] `packages/infra/drizzle.config.ts`
- [ ] Gerar primeira migration: `pnpm db:generate`

### Dia 11 — Client + Migration Runner
- [ ] `packages/infra/src/db/client.ts` (better-sqlite3 + Drizzle)
- [ ] `packages/infra/src/db/migrate.ts`
- [ ] `packages/infra/src/db/seed.ts` (seed agents iniciais)
- [ ] Tests de DB client (in-memory)
- [ ] Test de migration (apply + rollback)

### Critérios de Done
- `pnpm db:generate` cria migration a partir de schema
- `pnpm db:migrate` aplica migration sem erros
- `pnpm db:studio` abre Drizzle Studio
- DB tem 40+ tables criadas
- Tests de schema (Zod) passando

---

## Fase 3 — Setup Worker (5 dias)

**Objetivo**: Criar `apps/worker/` com HTTP server, MCP manager, e auth proxy.

### Dia 12 — Worker Scaffold
```bash
mkdir apps/worker && cd apps/worker
pnpm init
pnpm add fastify @fastify/websocket pino pino-pretty
```
- [ ] `apps/worker/src/index.ts` entry point
- [ ] `apps/worker/src/server.ts` Fastify HTTP server
- [ ] `apps/worker/src/config.ts` (env vars + Zod)
- [ ] `apps/worker/src/logger.ts` (Pino)
- [ ] `apps/worker/package.json` scripts (dev, build, start)
- [ ] `apps/worker/tsconfig.json`

### Dia 13 — MCP Manager
- [ ] `apps/worker/src/mcp/manager.ts` (spawn 19 MCPs)
- [ ] `apps/worker/src/mcp/bridge.ts` (JSON-RPC stdio)
- [ ] `apps/worker/src/mcp/catalog.ts` (registry)
- [ ] `apps/worker/src/mcp/types.ts`
- [ ] Tests com MCPs mock

### Dia 14 — HTTP Routes (basic CRUD proxy)
- [ ] `apps/worker/src/routes/agents.ts` (CRUD via Drizzle)
- [ ] `apps/worker/src/routes/skills.ts`
- [ ] `apps/worker/src/routes/mcp.ts` (start/stop/list)
- [ ] `apps/worker/src/routes/scheduler.ts`
- [ ] `apps/worker/src/routes/knowledge.ts`
- [ ] `apps/worker/src/routes/health.ts`
- [ ] Tests de cada route

### Dia 15-16 — Auth + SSE + WebSocket
- [ ] `apps/worker/src/middleware/auth.ts` (JWT validation)
- [ ] `apps/worker/src/routes/chat.ts` (SSE streaming)
- [ ] `apps/worker/src/routes/pty.ts` (WebSocket upgrade)
- [ ] `apps/worker/src/routes/voice.ts` (STT/TTS proxy)
- [ ] Test E2E: Next.js Route Handler → Worker

### Critérios de Done
- Worker roda em `localhost:4000`
- MCP manager spawna 19 MCPs
- Auth middleware valida JWT do Next.js
- SSE streaming funciona (chat:send)
- WebSocket funciona (pty)
- Tests passando

---

## Fase 4 — Clean Architecture Refactor (12 dias)

**Objetivo**: Extrair lógica de negócio do Electron main → packages domain/use-cases.

### Dia 17-19 — Domain Layer
- [ ] `packages/domain/src/entities/agent.ts`
- [ ] `packages/domain/src/entities/session.ts`
- [ ] `packages/domain/src/entities/message.ts`
- [ ] `packages/domain/src/entities/knowledge/document.ts`
- [ ] `packages/domain/src/entities/knowledge/chunk.ts`
- [ ] `packages/domain/src/entities/harness/project.ts`
- [ ] `packages/domain/src/entities/harness/sprint.ts`
- [ ] `packages/domain/src/entities/harness/round.ts`
- [ ] `packages/domain/src/entities/pipeline/project.ts`
- [ ] `packages/domain/src/entities/pipeline/phase.ts`
- [ ] Value objects: ModelId, ToolName, FilePath, CronExpression, EmbeddingVector
- [ ] Domain services: PricingCalculator, TokenEstimator, PermissionResolver
- [ ] Domain events: MessageSent, AgentCreated, SprintCompleted
- [ ] Tests unitários para cada entity (≥95% coverage)

### Dia 20-22 — Application Layer (Use Cases)
- [ ] `packages/use-cases/src/chat/SendMessage.ts`
- [ ] `packages/use-cases/src/chat/StreamMessage.ts`
- [ ] `packages/use-cases/src/chat/CompactSession.ts`
- [ ] `packages/use-cases/src/agents/CreateAgent.ts`
- [ ] `packages/use-cases/src/agents/UpdateAgent.ts`
- [ ] `packages/use-cases/src/agents/SyncToOrchestrator.ts`
- [ ] `packages/use-cases/src/skills/CreateSkill.ts`
- [ ] `packages/use-cases/src/knowledge/IngestDocument.ts`
- [ ] `packages/use-cases/src/knowledge/SearchKnowledge.ts`
- [ ] `packages/use-cases/src/scheduler/ScheduleTask.ts`
- [ ] `packages/use-cases/src/harness/StartProject.ts`
- [ ] `packages/use-cases/src/pipeline/StartDiscovery.ts`
- [ ] `packages/use-cases/src/vault/StoreSecret.ts`
- [ ] Tests unitários para cada use case (≥90% coverage)
- [ ] DI container setup (Inversify)

### Dia 23-25 — Infrastructure Layer
- [ ] `packages/infra/src/repos/drizzle-agent-repo.ts`
- [ ] `packages/infra/src/repos/drizzle-session-repo.ts`
- [ ] `packages/infra/src/repos/drizzle-message-repo.ts`
- [ ] `packages/infra/src/repos/drizzle-skill-repo.ts`
- [ ] `packages/infra/src/repos/drizzle-mcp-repo.ts`
- [ ] `packages/infra/src/repos/drizzle-knowledge-repo.ts`
- [ ] `packages/infra/src/repos/drizzle-harness-repo.ts`
- [ ] `packages/infra/src/repos/drizzle-pipeline-repo.ts`
- [ ] `packages/infra/src/repos/drizzle-vault-repo.ts`
- [ ] `packages/infra/src/repos/drizzle-settings-repo.ts`
- [ ] `packages/infra/src/repos/drizzle-scheduler-repo.ts`
- [ ] `packages/infra/src/repos/in-memory-*` (testes)
- [ ] Tests integration (SQLite in-memory)

### Dia 26-28 — AI Providers Strategy
- [ ] `packages/infra/src/ai-providers/types.ts` (AIProvider interface)
- [ ] `packages/infra/src/ai-providers/claude-agent-sdk-provider.ts`
- [ ] `packages/infra/src/ai-providers/claude-compat-sdk-provider.ts`
- [ ] `packages/infra/src/ai-providers/codex-sdk-provider.ts`
- [ ] `packages/infra/src/ai-providers/lion-sdk-provider.ts` (sub-adapters)
- [ ] `packages/infra/src/ai-providers/factory.ts`
- [ ] `packages/infra/src/ai-providers/mock-provider.ts` (tests)
- [ ] Tests para cada provider (≥85% coverage)

### Critérios de Done
- 100+ entities + value objects + services
- 50+ use cases implementados
- 30+ repository implementations
- 4 AI providers com strategy pattern
- Coverage: domain ≥95%, use-cases ≥90%, infra ≥85%

---

## Fase 5 — Migrar Worker Modules (18 dias)

**Objetivo**: Mover toda lógica de negócio do Electron main para `apps/worker/src/<domain>/`.

### Dia 29-32 — AI Module
- [ ] Mover `electron/main/codex-sdk/*` → `apps/worker/src/ai/codex-sdk/`
- [ ] Mover `electron/main/claude-compat-sdk/*` → `apps/worker/src/ai/claude-compat-sdk/`
- [ ] Mover `electron/main/lion-sdk/*` → `apps/worker/src/ai/lion-sdk/`
- [ ] Mover `electron/main/agent-runtime/*` → `apps/worker/src/ai/agent-runtime/`
- [ ] Refactor `electron/main/orchestrator.ts` → `apps/worker/src/ai/orchestrator.ts`
- [ ] Refactor `electron/main/prompt-builder.ts` → `apps/worker/src/ai/prompt-builder.ts`
- [ ] Tests E2E: 4 SDKs funcionando end-to-end

### Dia 33-35 — Telegram + Scheduler
- [ ] Mover `electron/main/telegram-bridge.ts` → `apps/worker/src/telegram/bridge.ts`
- [ ] Refactor `electron/main/scheduler.ts` → `apps/worker/src/scheduler/runner.ts`
- [ ] `apps/worker/src/scheduler/tasks.ts`
- [ ] `apps/worker/src/scheduler/activities.ts`
- [ ] Tests integration

### Dia 36-38 — Voice Module
- [ ] Mover `electron/main/voice-engine.ts` → `apps/worker/src/voice/engine.ts`
- [ ] Refactor Whisper local → `apps/worker/src/voice/whisper.ts`
- [ ] Refactor ElevenLabs → `apps/worker/src/voice/elevenlabs.ts`
- [ ] Refactor Cartesia → `apps/worker/src/voice/cartesia.ts`
- [ ] Refactor streaming TTS
- [ ] Tests com mocks

### Dia 39-40 — PTY + CodeBurn
- [ ] Mover `electron/main/codeburn-pty.ts` → `apps/worker/src/pty/server.ts`
- [ ] WebSocket bridge (worker → next → browser)
- [ ] Tests integration

### Dia 41-43 — Dreaming + Memory
- [ ] Mover `electron/main/dreaming-gate.ts` → `apps/worker/src/dreaming/gate.ts`
- [ ] Mover `electron/main/dreaming-turn-engine.ts` → `apps/worker/src/dreaming/turn-engine.ts`
- [ ] Mover `electron/main/memory-pipeline.ts` → `apps/worker/src/memory/pipeline.ts`
- [ ] Mover `electron/main/embedding-provider.ts` → `apps/worker/src/embeddings/anthropic.ts`
- [ ] Tests integration

### Dia 44-46 — Harness + Pipeline + Enrich
- [ ] Mover `electron/main/harness-engine.ts` → `apps/worker/src/harness/engine.ts`
- [ ] Mover `electron/main/harness-planner.ts` → `apps/worker/src/harness/planner.ts`
- [ ] Mover `electron/main/harness-evaluator.ts` → `apps/worker/src/harness/evaluator.ts`
- [ ] Mover `electron/main/harness-prompts.ts` → `apps/worker/src/harness/prompts.ts`
- [ ] Mover `electron/main/pipeline-engine/*` → `apps/worker/src/pipeline/engine.ts`
- [ ] Mover `electron/main/pipeline-shared/*` → `apps/worker/src/pipeline/shared/`
- [ ] Mover `electron/main/open-design/manager.ts` → `apps/worker/src/pipeline/open-design-manager.ts`
- [ ] Mover `electron/main/enrich/*` → `apps/worker/src/enrich/engine.ts`
- [ ] Tests E2E

### Dia 47-48 — Knowledge + Secrets
- [ ] Mover `electron/main/knowledge-engine.ts` → `apps/worker/src/knowledge/engine.ts`
- [ ] Mover `electron/main/knowledge-benchmark.ts` → `apps/worker/src/knowledge/benchmark.ts`
- [ ] Mover `electron/main/graph-ingest.ts` → `apps/worker/src/knowledge/graph-ingest.ts`
- [ ] Mover `electron/main/mgraph-engine.ts` → `apps/worker/src/knowledge/mgraph.ts`
- [ ] Mover `electron/main/secrets-vault.ts` → `apps/worker/src/secrets/vault.ts`
- [ ] Tests integration

### Critérios de Done
- Toda lógica de negócio movida para `apps/worker/`
- Electron main只剩下 ~50 linhas (apenas window/tray management)
- Worker totalmente self-contained
- Todos os 11 domínios funcionais end-to-end

---

## Fase 6 — Seed Agents YAML (4 dias)

**Objetivo**: Migrar 67 arquivos `.ts` (9610 linhas) → YAML.

### Dia 49 — Loader
- [ ] `apps/worker/src/seed-agents/loader.ts` (lê `.wolfkrow/agents/*.yaml`)
- [ ] `apps/worker/src/seed-agents/schema.ts` (Zod schema para YAML)
- [ ] `apps/worker/src/seed-agents/validator.ts`
- [ ] Tests

### Dia 50-52 — Migration
- [ ] Converter 67 seed agents `.ts` → `.yaml`
- [ ] `pnpm seed:agents` (script de conversão)
- [ ] Smoke tests por agent
- [ ] Documentation: como criar custom agents

### Critérios de Done
- 67 agents convertidos
- Loader valida com Zod
- Todos passam smoke test
- Total de linhas reduzidas em ~80% (de 9610 para ~2000 YAML)

---

## Fase 7 — Next.js Pages Migration (12 dias)

**Objetivo**: Migrar 19 páginas para Next.js App Router.

### Dia 53-54 — Layout Root + Auth
- [ ] `apps/web/app/layout.tsx` (root: providers + theme)
- [ ] `apps/web/app/(auth)/login/page.tsx`
- [ ] `apps/web/app/(auth)/onboarding/page.tsx`
- [ ] `apps/web/app/(auth)/unlock/page.tsx`
- [ ] `apps/web/app/(app)/layout.tsx` (auth gate + Sidebar)
- [ ] `apps/web/components/common/Sidebar.tsx` (shadcn-based)

### Dia 55-57 — Chat (mais complexa)
- [ ] `apps/web/app/(app)/chat/page.tsx` (RSC: list sessions)
- [ ] `apps/web/components/chat/ChatView.tsx` (Client: streaming)
- [ ] `apps/web/components/chat/ChatMessage.tsx` (shadcn Card)
- [ ] `apps/web/components/chat/ConfirmDialog.tsx` (AlertDialog)
- [ ] `apps/web/components/chat/AskQuestionDialog.tsx` (Dialog + RadioGroup)
- [ ] `apps/web/components/chat/TokenCounter.tsx` (Tooltip + Badge)
- [ ] `apps/web/components/chat/VoiceOrb.tsx` (custom motion)
- [ ] `apps/web/components/chat/VoiceRecorder.tsx` (Web Audio API)
- [ ] `apps/web/components/chat/AudioPlayer.tsx` (Slider + Button)
- [ ] `apps/web/components/chat/ArtifactRenderer.tsx` (Tabs)
- [ ] `apps/web/components/chat/SlashCommandPicker.tsx` (cmdk Command)
- [ ] `apps/web/lib/sse/useChatStream.ts`
- [ ] SSE reconnection logic
- [ ] Tests component + E2E

### Dia 58 — Agents + Skills + MCPs
- [ ] `apps/web/app/(app)/agents/page.tsx`
- [ ] `apps/web/components/agents/AgentList.tsx`
- [ ] `apps/web/components/agents/AgentFormModal.tsx` (shadcn Form + react-hook-form)
- [ ] `apps/web/components/agents/DeleteAgentDialog.tsx`
- [ ] `apps/web/components/agents/SyncAgentsModal.tsx`
- [ ] `apps/web/app/(app)/skills/page.tsx`
- [ ] `apps/web/components/skills/SkillEditor.tsx` (Markdown + frontmatter)
- [ ] `apps/web/app/(app)/mcp/page.tsx`
- [ ] `apps/web/components/mcp/MCPList.tsx`
- [ ] `apps/web/components/mcp/MCPForm.tsx`
- [ ] Tests

### Dia 59 — Scheduler + Tasks + Channels
- [ ] `apps/web/app/(app)/scheduler/page.tsx`
- [ ] `apps/web/components/scheduler/TaskList.tsx`
- [ ] `apps/web/components/scheduler/TaskFormModal.tsx`
- [ ] `apps/web/components/scheduler/CalendarView.tsx` (react-day-picker)
- [ ] `apps/web/components/scheduler/KanbanView.tsx` (dnd-kit)
- [ ] `apps/web/app/(app)/tasks/page.tsx`
- [ ] `apps/web/app/(app)/channels/page.tsx`
- [ ] `apps/web/components/channels/TelegramSetup.tsx`

### Dia 60-61 — Pipeline + Harness + Enrich
- [ ] `apps/web/app/(app)/pipeline/page.tsx`
- [ ] `apps/web/components/pipeline/PipelineProjectList.tsx`
- [ ] `apps/web/components/pipeline/PipelineChatView.tsx`
- [ ] `apps/web/components/pipeline/SprintExecutionView.tsx`
- [ ] `apps/web/components/pipeline/PipelineMetricsReport.tsx` (recharts)
- [ ] `apps/web/app/(app)/harness/page.tsx`
- [ ] `apps/web/components/harness/ProjectList.tsx`
- [ ] `apps/web/components/harness/ExecutionView.tsx`
- [ ] `apps/web/components/harness/MetricsView.tsx`

### Dia 62 — Knowledge + Memory + Vault
- [ ] `apps/web/app/(app)/knowledge/page.tsx`
- [ ] `apps/web/components/knowledge/UploadDropZone.tsx`
- [ ] `apps/web/components/knowledge/DocumentList.tsx`
- [ ] `apps/web/components/knowledge/SearchPanel.tsx`
- [ ] `apps/web/components/knowledge/GraphCanvas.tsx` (D3 force layout)
- [ ] `apps/web/app/(app)/memory/page.tsx`
- [ ] `apps/web/app/(app)/vault/page.tsx`
- [ ] `apps/web/components/vault/SecretList.tsx`
- [ ] `apps/web/components/vault/SecretForm.tsx`

### Dia 63-64 — Settings + Logs + Usage + Permissions
- [ ] `apps/web/app/(app)/settings/page.tsx`
- [ ] `apps/web/components/settings/OrchestratorSelector.tsx`
- [ ] `apps/web/components/settings/VoiceSelector.tsx`
- [ ] `apps/web/components/settings/ExternalProvidersPanel.tsx`
- [ ] `apps/web/components/settings/CompactionModelSelector.tsx`
- [ ] `apps/web/app/(app)/logs/page.tsx` (SSE live tail)
- [ ] `apps/web/app/(app)/usage/page.tsx` (recharts)
- [ ] `apps/web/app/(app)/permissions/page.tsx`

### Critérios de Done
- 19 páginas funcionais
- Todas usando shadcn/ui
- RSC onde possível, Client onde necessário
- SSE streaming funcionando em Chat, Pipeline, Harness, Logs
- Server Actions para mutations

---

## Fase 8 — Componentes shadcn (12 dias)

**Objetivo**: Substituir 50+ componentes custom por shadcn/ui.

### Dia 65-67 — Forms (maior impacto)
- [ ] Refactor `AgentFormModal.tsx` (1765 linhas) → shadcn Form + react-hook-form (target: 400 linhas)
- [ ] Refactor `ExternalProvidersPanel.tsx` (1097 linhas) → shadcn Form (target: 300 linhas)
- [ ] Refactor `OrchestratorSelector.tsx` (633 linhas) → Card + RadioGroup (target: 200 linhas)
- [ ] Refactor `NewPipelineModal.tsx` (597 linhas) → Dialog + Form
- [ ] Refactor `TaskFormModal.tsx` (422 linhas) → Dialog + Form
- [ ] Refactor `SyncAgentsModal.tsx` (672 linhas) → Dialog + DataTable

### Dia 68-69 — Tables
- [ ] `apps/web/components/ui/data-table.tsx` (TanStack Table)
- [ ] Refactor `PipelineMetricsReport.tsx` (1647 linhas) → DataTable + Charts (target: 600 linhas)
- [ ] Refactor `AgentList.tsx` → DataTable
- [ ] Refactor `SkillList.tsx` → DataTable
- [ ] Refactor `MCPList.tsx` → DataTable
- [ ] Refactor `DocumentList.tsx` → DataTable

### Dia 70-71 — Visualizadores
- [ ] Refactor `SprintExecutionView.tsx` (1643 linhas) → Tabs + Cards + Stream (target: 500 linhas)
- [ ] Refactor `ArchitectureReviewArtifactView.tsx` (858 linhas) → ScrollArea + Code + Badge (target: 300 linhas)
- [ ] Refactor `AuditFinalSummaryView.tsx`, `AuditMultiPanelView.tsx` → Accordion + Card
- [ ] Refactor `PhaseHistoryView.tsx` → Timeline

### Dia 72-73 — Modais e Drawers
- [ ] `apps/web/components/ui/sheet.tsx` (drawer)
- [ ] Refactor `CodexAuthRequiredModal.tsx`, `CodexWindowsPrepDialog.tsx` → AlertDialog
- [ ] Refactor `DestructiveUnlockModal.tsx`, `ResetConfirmDialog.tsx` → AlertDialog
- [ ] Refactor `IngestSettingsDrawer.tsx` → Sheet

### Dia 74-76 — Componentes restantes
- [ ] Refactor 30+ componentes menores
- [ ] Criar variants consistentes com cva
- [ ] Documentar em Storybook
- [ ] Adicionar testes @testing-library

### Critérios de Done
- 50+ componentes refatorados para shadcn
- Linhas totais reduzidas em ~60%
- Storybook documenta todos
- Tests passing

---

## Fase 9 — SSE + WebSocket Bridges (6 dias)

**Objetivo**: Streaming confiável + bidirectional PTY.

### Dia 77-78 — SSE Infrastructure
- [ ] `apps/web/lib/sse/useSSE.ts` (reusable hook)
- [ ] `apps/web/lib/sse/reconnect.ts` (exponential backoff)
- [ ] `apps/web/lib/sse/event-types.ts` (Zod schemas)
- [ ] `apps/web/components/common/StreamIndicator.tsx`
- [ ] Tests E2E

### Dia 79-80 — Chat Streaming
- [ ] SSE streaming Chat → User
- [ ] Backpressure handling
- [ ] Cancel/abort support
- [ ] Tool call rendering inline
- [ ] Metrics display

### Dia 81-82 — Pipeline + Harness + Logs Streaming
- [ ] SSE Pipeline phases
- [ ] SSE Harness rounds
- [ ] SSE Logs live tail
- [ ] SSE Dreaming events
- [ ] SSE Memory compaction

### Dia 83-84 — WebSocket PTY
- [ ] `apps/web/lib/ws/usePty.ts` (reusable)
- [ ] Terminal resize handling
- [ ] xterm.js integration
- [ ] Tests E2E com Playwright

### Critérios de Done
- SSE reconnect funciona após network drop
- 5+ tipos de streaming funcionando
- PTY bidirectional testado
- Latência <100ms end-to-end

---

## Fase 10 — Sidecar Open Design (4 dias)

**Objetivo**: Separar Open Design em app Next.js independente.

### Dia 85-86 — Scaffold
- [ ] `apps/sidecar/package.json` (Next.js 15)
- [ ] `apps/sidecar/app/page.tsx` (canvas principal)
- [ ] `apps/sidecar/app/api/health/route.ts`
- [ ] Mover `vendor/open-design/apps/*` → `apps/sidecar/`
- [ ] Mover `vendor/open-design/packages/*` → `packages/design-tools/`

### Dia 87-88 — Integration com Worker
- [ ] Worker spawns sidecar como subprocess (porta 5000)
- [ ] Wolfkrow UI embute via iframe
- [ ] Auth compartilhado (cookie cross-origin via worker proxy)
- [ ] Tests E2E

### Critérios de Done
- Open Design roda independente em porta 5000
- Worker gerencia lifecycle
- UI embute via iframe
- Autenticação compartilhada

---

## Fase 11 — Electron Wrapper (2 dias)

**Objetivo**: Wrapper mínimo para systray + hotkey + auto-launch.

### Dia 89 — Wrapper
- [ ] `apps/wrapper/package.json` (Electron 33+)
- [ ] `apps/wrapper/src/main.ts` (~300 linhas)
- [ ] `apps/wrapper/src/preload.ts` (contextBridge)
- [ ] Systray com menu (Open, Quick Chat, Lock, Quit)
- [ ] Global hotkey (Cmd+Shift+Space)
- [ ] Auto-launch on login
- [ ] Browser window (PWA local)

### Dia 90 — Build + Test
- [ ] `electron-builder.yml` para wrapper
- [ ] Build DMG macOS
- [ ] Build NSIS Windows
- [ ] Build AppImage Linux
- [ ] Test em 3 plataformas

### Critérios de Done
- Wrapper instala via DMG/NSIS
- Systray funciona
- Hotkey global funciona
- Browser abre para PWA local

---

## Fase 12 — PWA + Service Worker (2 dias)

**Objetivo**: PWA installable com offline shell.

### Dia 91 — PWA Setup
- [ ] `apps/web/public/manifest.json`
- [ ] `apps/web/public/icons/{192,512, maskable}.png`
- [ ] `apps/web/app/sw.ts` (Service Worker via Serwist)
- [ ] `apps/web/next.config.ts` com Serwist
- [ ] Install prompt

### Dia 92 — Offline + Shortcuts
- [ ] Offline shell (HTML + critical CSS + JS)
- [ ] NetworkFirst strategy para API
- [ ] CacheFirst para assets
- [ ] App shortcuts (Chat, Knowledge)
- [ ] Tests com Chrome DevTools

### Critérios de Done
- `pnpm build` gera PWA válida
- Lighthouse PWA score ≥95
- Install prompt aparece
- Funciona offline (read-only)

---

## Fase 13 — Testes (28 dias)

**Objetivo**: 730+ testes com coverage targets atingidos.

### Dia 93-98 — Unit Tests (400 testes, +6 dias)
- [ ] `packages/domain/src/__tests__/entities/*.test.ts` (100 testes)
- [ ] `packages/domain/src/__tests__/services/*.test.ts` (50 testes)
- [ ] `packages/use-cases/src/__tests__/**/*.test.ts` (150 testes)
- [ ] `packages/infra/src/__tests__/repos/*.test.ts` (60 testes, com SQLite in-memory)
- [ ] `packages/infra/src/__tests__/ai-providers/*.test.ts` (40 testes)
- [ ] Target: domain ≥95%, use-cases ≥90%

### Dia 99-102 — Integration Tests (80 testes, +4 dias)
- [ ] `apps/web/__tests__/api/*.test.ts` (40 testes, Route Handlers)
- [ ] `apps/worker/__tests__/routes/*.test.ts` (40 testes, Worker HTTP)
- [ ] DB migrations up/down tests
- [ ] Target: ≥85%

### Dia 103-108 — Component Tests (200 testes, +6 dias)
- [ ] `apps/web/components/chat/__tests__/*.test.tsx` (50 testes)
- [ ] `apps/web/components/agents/__tests__/*.test.tsx` (40 testes)
- [ ] `apps/web/components/pipeline/__tests__/*.test.tsx` (30 testes)
- [ ] `apps/web/components/knowledge/__tests__/*.test.tsx` (30 testes)
- [ ] `apps/web/components/common/__tests__/*.test.tsx` (50 testes)
- [ ] Target: ≥70% (≥80% para forms/auth)

### Dia 109-114 — E2E Tests (50 cenários, +6 dias)
- [ ] Setup Playwright + config
- [ ] `e2e/auth.spec.ts` (login, TOTP, lock)
- [ ] `e2e/chat.spec.ts` (send message, streaming, tool calls)
- [ ] `e2e/agents.spec.ts` (CRUD, sync)
- [ ] `e2e/knowledge.spec.ts` (upload, search)
- [ ] `e2e/pipeline.spec.ts` (full BuildPlan flow)
- [ ] `e2e/harness.spec.ts` (Planner→Coder→Evaluator)
- [ ] `e2e/voice.spec.ts` (STT + TTS)
- [ ] `e2e/scheduler.spec.ts` (cron + review)
- [ ] `e2e/mcp.spec.ts` (start/stop MCPs)
- [ ] `e2e/wrapper.spec.ts` (systray + hotkey)

### Dia 115-120 — Coverage Audit + Polish (6 dias)
- [ ] `pnpm test:cov` em todos packages
- [ ] Identificar gaps de coverage
- [ ] Adicionar tests faltantes
- [ ] Visual regression (Playwright snapshots)
- [ ] Accessibility audit (axe-core)
- [ ] Performance audit (Lighthouse CI)

### Critérios de Done
- 730+ testes passando
- Coverage: backend ≥85%, frontend ≥70%
- E2E passa em Chrome + Firefox + Edge
- Visual regression baseline criada
- Lighthouse score ≥90

---

## Fase 14 — Otimizações (6 dias)

**Objetivo**: Performance targets atingidos.

### Dia 121-122 — Bundle Optimization
- [ ] Code-splitting analysis (`@next/bundle-analyzer`)
- [ ] Dynamic imports por rota
- [ ] Tree-shaking de shadcn não usados
- [ ] Lazy load voice engine
- [ ] Target: initial bundle <300KB

### Dia 123-124 — RSC + Streaming
- [ ] Maximizar uso de RSC (target 70% de pages)
- [ ] Suspense boundaries em streaming
- [ ] Partial Prerendering (PPR experimental)
- [ ] `use cache` directive para dados estáticos

### Dia 125-126 — DB + Cache
- [ ] Indices optimization (SQLite EXPLAIN)
- [ ] sqlite-vec IVF index se docs > 10k
- [ ] TanStack Query cache config (5min stale, 30min gc)
- [ ] Image optimization (next/image + WebP)

### Critérios de Done
- Lighthouse Performance ≥95
- TTFB <200ms
- LCP <1.5s
- TTI <2.5s

---

## Fase 15 — Documentação (4 dias)

**Objetivo**: Docs completas para usuários e devs.

### Dia 127 — User Docs
- [ ] `README.md` (atualizado)
- [ ] `docs/USER_GUIDE.md` (como usar)
- [ ] `docs/INSTALLATION.md` (instalação em 3 OS)
- [ ] `docs/TROUBLESHOOTING.md`
- [ ] `docs/MIGRATION_FROM_LIONCLAW.md`

### Dia 128 — Dev Docs
- [ ] `docs/DEVELOPMENT.md` (setup dev)
- [ ] `docs/CONTRIBUTING.md`
- [ ] `docs/ARCHITECTURE.md` (atualizado)
- [ ] `docs/TESTING.md`
- [ ] `docs/DEPLOYMENT.md`

### Dia 129-130 — API Docs + Storybook
- [ ] OpenAPI spec gerada de Zod (via `zod-to-openapi`)
- [ ] Docs site (Docusaurus ou Nextra)
- [ ] Storybook deploy (Chromatic ou Vercel)
- [ ] JSDoc em todas public APIs

### Critérios de Done
- README com quick start <5min
- Guia de migração LionClaw v3 → Wolfkrow v1.0
- OpenAPI spec completa
- Storybook com 50+ stories

---

## Fase 16 — CI/CD + Distribuição (4 dias)

**Objetivo**: Pipeline de release automatizado.

### Dia 131-132 — GitHub Actions
- [ ] `.github/workflows/ci.yml` (lint + typecheck + test + build)
- [ ] `.github/workflows/release.yml` (tag → DMG/NSIS/AppImage)
- [ ] `.github/workflows/nightly.yml` (cron build)
- [ ] Matrix: macOS-latest, windows-latest, ubuntu-latest
- [ ] Turborepo remote cache (Vercel)
- [ ] Codecov integration
- [ ] SonarCloud (opcional)

### Dia 133-134 — Release
- [ ] Code signing setup (Apple Developer cert)
- [ ] Windows EV cert (opcional)
- [ ] electron-builder notarization
- [ ] DMG + NSIS + AppImage artifacts
- [ ] Auto-update channel (GitHub Releases)
- [ ] Crash reporting (Sentry opt-in)

### Critérios de Done
- CI green em 3 OS
- Tag → Release em <30min
- DMG assinado funciona em macOS limpo
- NSIS instala silenciosamente

---

## Fase 17 — Beta Testing + Polish (6 dias)

**Objetivo**: Release candidate estável.

### Dia 135-136 — Beta Fechado
- [ ] Distribuir para 5 beta testers
- [ ] Coletar feedback (form + Discord)
- [ ] Bug bash (24h sprint)
- [ ] Performance profiling
- [ ] Accessibility audit final

### Dia 137-138 — Polish
- [ ] Fix critical bugs
- [ ] Melhorias UX baseadas em feedback
- [ ] Onboarding wizard polish
- [ ] Empty states
- [ ] Error states
- [ ] Loading states

### Dia 139-140 — Pre-Release
- [ ] CHANGELOG.md completo
- [ ] Migration guide testado
- [ ] Landing page (opcional)
- [ ] Demo video (opcional)
- [ ] Press kit

### Critérios de Done
- 0 critical bugs
- 0 known blockers
- Beta testers satisfeitos (NPS ≥8)
- Performance targets atingidos

---

## Fase 18 — Release v1.0 (M7)

**Objetivo**: Release público no GitHub.

### Dia 141-145 — Release Day
- [ ] Tag `v1.0.0`
- [ ] GitHub Release com notas
- [ ] Publicar DMG + NSIS + AppImage
- [ ] Update README com badges
- [ ] Tweet announcement (opcional)
- [ ] Post em Reddit r/LocalLLaMA, r/ChatGPT (opcional)
- [ ] Blog post (opcional)

---

## Resumo de Entregas por Marco

### M0 (dia 3)
- Monorepo Turborepo + pnpm
- Lint + Format + Hooks
- CI GitHub Actions
- Docs skeleton

### M1 (dia 18)
- Next.js 15 + shadcn + Storybook
- Drizzle schema (40+ tables)
- Worker scaffold + MCP manager
- 1 página demo (Chat) E2E

### M2 (dia 36)
- Clean Arch completa (domain + use-cases + infra)
- 5 páginas migradas
- Design system aplicado

### M3 (dia 64)
- UI 100% migrada (19 páginas)
- shadcn 100% aplicado
- SSE + WebSocket bridges

### M4 (dia 76)
- Sidecar separado
- PWA installable
- Electron wrapper

### M5 (dia 104)
- 730+ testes passando
- Coverage targets atingidos
- Lighthouse ≥95

### M6 (dia 116)
- Beta RC (DMG + NSIS + AppImage)
- CI/CD completo
- Code signing

### M7 (dia 136)
- v1.0 público
- Beta testing completo
- Documentação final

---

## Riscos & Mitigações

| # | Risco | Prob | Impact | Mitigação |
|---|---|---|---|---|
| 1 | SSE falha em corporate firewalls | Média | Alto | Fallback long-polling |
| 2 | Whisper local consome RAM | Média | Médio | OpenAI API alternativa |
| 3 | 78 migrations não portam 1:1 | Alta | Alto | Re-derivar Drizzle do zero |
| 4 | Code signing caro | Alta | Médio | Self-signed dev, docs para prod |
| 5 | Browser throttling SSE | Alta | Médio | Service Worker + docs |
| 6 | Codex OAuth requer callback | Alta | Médio | Local server porta 1455 |
| 7 | 19 MCPs quebram | Média | Médio | Versioning + smoke tests |
| 8 | Time-to-market longo | Média | Alto | MVP focado (chat + knowledge + harness) |

---

## Acompanhamento

- **Daily standup**: status + blockers
- **Weekly review**: progresso vs plano
- **Bi-weekly demo**: feature completa
- **Monthly retrospective**: processo + melhorias
- **Quarterly OKR review**: alinhamento estratégico

---

**Última atualização**: 2026-06-20
**Próxima revisão**: 2026-07-01 (após M0)
