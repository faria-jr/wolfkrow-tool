# Changelog

All notable changes to Wolfkrow are documented in this file.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)  
Versioning: [Semantic Versioning](https://semver.org/spec/v2.0.0.html)

---

## [1.0.0] — 2026-06-24

First production release of Wolfkrow Tool. Complete rewrite from LionClaw, built on:
- TypeScript / Node.js 24
- Next.js 15 (App Router) + React 19
- Fastify (worker process)
- better-sqlite3 + Drizzle ORM
- Electron 30 (wrapper)
- Anthropic SDK + Claude 4 models

### Added

#### Runtime & Infrastructure
- **Node.js 24 as official runtime** — upgraded from Node 18/20; uses built-in `fetch`, `crypto.randomUUID`, native `--watch` (ADR-0029)
- **Claude-compat providers** — Z.ai, MiniMax, Moonshot, Qwen via OpenAI-compatible endpoints (ADR-0030)
- **OpenRouter support** — single API key, access to 100+ models via `openrouter/` prefix
- **Structured logging** — Pino in worker; lightweight JSON logger in Electron wrapper
- **Domain EventBus** — `InMemoryEventBus`, `createDomainEvent`; `message.turn.completed` published on each turn
- **Permission store TTL** — tool permission requests auto-deny after 5 minutes; drain on shutdown
- **Dependency injection** — `McpManager` accepts domain interfaces via constructor; no infra imports in manager layer

#### Chat & Agents
- **68 seed agents migrated** from LionClaw YAML format with Zod schema validation
- **Skills built-in** loaded from `.wolfkrow/skills/` filesystem on startup
- **Session management** — create, list, archive, delete; title auto-derived from first message
- **Confirm dialog** for destructive tool calls; AskQuestion dialog for structured user prompts
- **Stop button** with `AbortController` propagating through use-case → AI provider → SSE stream
- **Partial message flush** on abort — message is preserved, not lost
- **Tool permission UI** with 5-minute TTL and approve/deny flow

#### Knowledge Base
- **Hybrid search** — FTS5 keyword + cosine similarity JS fallback; citation with chunk references (M4)
- **sqlite-vec vec0 support** — opt-in vector search when native extension available (ADR-0028)

#### MCP Servers
- **15 built-in MCPs** with real binaries in `packages/mcp-servers/`:
  - Google Calendar, Gmail, Drive, Sheets
  - ElevenLabs TTS, Excalidraw, YouTube
  - Memory search, Local agents, Local LLM (Ollama)
  - Shopify, Nano-banana, Knowledge base, wolfkrow-skills, Graph search
- **MCP UI** — source badges, health check status, visibility toggle (M3.5)
- **JSON-RPC stdio transport** — real MCP protocol (replaced mock) (ADR fixed G7)
- **Remote MCPs** (Higgsfield, Blotato) deferred to v2 (ADR-0031)

#### Harness (Build Automation)
- **Domain + infra + use-cases + UI** for Planner→Coder→Evaluator workflow
- **DiffViewer component** for round output deltas (M5.3)
- **Sprint + round metrics** — pass rate, latency, delta visualization

#### Pipeline (BuildPlan)
- **Multi-phase BuildPlan** with named templates
- **Phase kinds** — `implementation`, `review`, `report`
- **Approve-with-edits flow** (M5.4)
- **Bridge to Harness** — implementation stage spawns a Harness project (M5.7)

#### Memory & Dreaming
- **Memory pipeline** — compaction, daily, semantic lifecycle (FIX-012)
- **Dreaming** — idle + turn-triggered maintenance (FIX-013)
- **Memory Summaries tab** + **Compact Now button** (M6.1)
- **Auto-compaction** — threshold-based session compaction (T29)

#### Scheduler
- **Cron engine** with DI via `ISchedulerRepository`
- **Review queue** for human-in-the-loop task approval
- **DrizzleSchedulerRepository** class (replaces function factory)
- **Kanban + calendar UI** for task management (T12)

#### Audit Log
- **`audit_events` table** — logs all tool calls with agent, session, input, output
- **Audit log table UI** with CSV and JSON export (M6.4)

#### Auth & Security
- **`middleware.ts`** protecting all app routes (G1 fix)
- **JWKS keypair** persists across restarts in DB (G2 fix)
- **JWT + cookie authentication** with TOTP support (ADR-0017)
- **Vault** via `keytar` — AES-256-GCM + PBKDF2 for encrypted backup
- **35 database indexes** added to schemas (G6 fix)

#### Voice
- **VAD + barge-in** voice conversation (FIX-011)
- **Whisper.cpp subprocess** for local STT without per-token cost (T28)
- **TTS factory** — ElevenLabs / Cartesia selectable per agent (FIX-030)
- **Voice orb UI** in chat (FIX-011)

#### Integrations
- **Telegram bridge** — `OrchestratorChatAdapter` for real bidirectional chat (FIX-014)
- **Open Design Studio** — `apps/sidecar` Next.js sidecar with iframe embed (S.6)
- **Enrich pipeline** — Validator→Enricher with UI (T8)

#### UI & Frontend
- **PWA** — service worker (Serwist), manifest, icons (ADR-0019)
- **SSE chat streaming** — `streamSse()` utility, `useMessageState`, `useToolPermission` hooks
- **Usage analytics** — charts + budget banner + multi-model cost comparison (FIX-032)
- **Logs page** — `LogViewer` + SSE stream of worker logs
- **CodeBurn terminal** — `TerminalPage` + PTY server (FIX-035 equivalent)
- **Graph search UI** — knowledge graph query interface
- **Settings page** — provider config, vault, agents, MCP management

#### DevOps & Tooling
- **LionClaw → Wolfkrow migrator** — `scripts/migrate-lionclaw.ts` with dry-run + rollback
- **`worktree-manager.sh`** + **`state-manager.sh`** for CI orchestration
- **Storybook** integration for design system

### Changed

- **AI provider interface** — `query()` returns `AsyncIterable<AIStreamChunk>` (replaced callback-based) (G3 fix)
- **MCP catalog** — `visibility: always | on-demand | planned` (honesty about what exists) (G9 fix)
- **Clean Architecture** enforced — infra imports removed from domain and use-case layers (G8 fix)
- **`SendMessageUseCase` constructor** — 4-param options bag `{ usageRepo, eventBus }` replacing positional args
- **ESLint rules** — `max-lines: 300`, `max-lines-per-function: 50`, `max-params: 4`, `complexity: 10`

### Fixed

- 15 code-review findings applied (see `docs/review-audit.md`):
  - FIX-R01: `AbortError` handling for Anthropic `APIUserAbortError`
  - FIX-R02: SSE stream closed cleanly on abort (yield done chunk)
  - FIX-R03: `hasPendingPermission` export for test isolation
  - FIX-R04: `DrizzleSchedulerRepository` class + `ISchedulerRepository` interface
  - FIX-R05–R15: Various type safety, DI, and architectural fixes (M7.1–M7.8)

### Removed

- **Knowledge benchmark** (SPEC-004 retrieval eval) — descoped to v1.1 (ADR-0032)
- **`getScheduledTasksRepository()` function factory** — replaced by `DrizzleSchedulerRepository` class
- **Direct infra imports from `McpManagerImpl`** — replaced by DI via `McpManagerOptions`
- **`console.warn/error` in Electron wrapper** — replaced by structured logger

### Breaking Changes (from LionClaw)

1. **Node.js 24 required** — Node 18/20 no longer supported.
2. **Vault values not migrated** — secret values must be re-entered after migration (security; only keys/names migrate).
3. **Provider configuration** — LionClaw `executor` field maps to Wolfkrow `provider`; see `MIGRATION_FROM_LIONCLAW.md`.
4. **DB schema** — new tables not present in LionClaw (see migration guide for full list).
5. **`sa-*` agent format** — deprecated in favor of `spec-*` YAML format.

### Known Issues (deferred to v1.1)

- Harness AI execution loop (Planner→Coder→Evaluator) is UI-scaffolded only; no auto AI execution yet
- Memory search UI not implemented
- Audit log advanced filters (date/type/agent) not implemented
- Pipeline report (final execution summary) not implemented
- Excalidraw inline embed in chat messages not implemented
- Artifact detection for tool results not implemented
- G4 (business logic in agent-executor) only partially resolved

---

## [0.x.x] — Pre-release (LionClaw era)

See `MIGRATION_FROM_LIONCLAW.md` for history of the LionClaw v3.0 codebase that Wolfkrow was built from.
