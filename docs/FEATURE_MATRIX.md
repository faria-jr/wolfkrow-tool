# Wolfkrow Tool — Feature Matrix (Rastreabilidade reconciliada)

> Reconciliado em 2026-06-22 contra código real (commit 618b3ee + auditoria completa de todos os arquivos).
> Legenda: ✅ feito · 🟡 parcial/placeholder · ⛔ não iniciado

---

## Chat & Orquestração (15)

| # | Funcionalidade | SPEC | Status | Commit/FIX |
|---|---|---|---|---|
| 1 | Chat multi-SDK (Anthropic/Codex/Ollama/LionProvider) | SPEC-002 | ✅ | FIX-005/007 |
| 2 | Onboarding c/ escolha de SDK (wizard) | SPEC-001 | 🟡 setup senha ✅; escolha SDK ✅ reconciliamento Task 9 | Task 9 |
| 3 | Sub-agentes CRUD + runtime + sync massa | SPEC-013 | ✅ | FIX-004/005 |
| 4 | Skills (editor markdown+frontmatter) | SPEC-014 | ✅ | FIX-016 |
| 5 | MCP servers (lifecycle start/stop/restart, discovery) | SPEC-008 | ✅ 3 built-in; custom create ✅ Task 10 | FIX-006/017; Task 10 |
| 6 | Memory pipeline (compaction/daily/semantic) | SPEC-015 | ✅ | FIX-012 |
| 7 | Dreaming (idle + turn) | SPEC-015 | ✅ | FIX-013 |
| 8 | Session management (criar/listar/arquivar/deletar) | SPEC-002 | 🟡 in-memory; persistência parcial | — |
| 9 | Title generation automático | SPEC-002 | ✅ deriveTitle() no chat-view | FIX-028 |
| 10 | Confirm dialog (permissões destrutivas) | SPEC-002 | ✅ ConfirmDialog component | FIX-028 |
| 11 | Ask user question (estruturada) | SPEC-002 | ✅ AskQuestionDialog component | FIX-028 |
| 12 | Voice conversation (VAD/barge-in) | SPEC-003 | ✅ | FIX-011 |
| 13 | STT (Whisper local / OpenAI) | SPEC-003 | 🟡 provider integrado | FIX-011 |
| 14 | TTS (ElevenLabs / Cartesia) | SPEC-003 | ✅ factory TTS selecionável | FIX-030 |
| 15 | Voice orb UI | SPEC-003 | ✅ VoiceOrb no chat | FIX-011 |

## Build & Automação (7)

| # | Funcionalidade | SPEC | Status | Commit/FIX |
|---|---|---|---|---|
| 16 | Harness (Planner→Coder→Evaluator, sprints/rounds/métricas) | SPEC-005 | 🟡 domain+infra+use-cases+UI ✅; sem execução AI automática | — |
| 17 | Pipeline (BuildPlan multi-fase) | SPEC-006 | 🟡 domain+infra+routes+UI ✅; templates nomeados ✅ Task 11 | Task 11 |
| 18 | Open Design Studio (sidecar Next.js) | SPEC-007 | ✅ apps/sidecar + DesignStudio iframe embed | S.6 commit 1329c87 |
| 19 | Enrich pipeline (Validator→Enricher) | SPEC-016 | 🟡 API backend ✅; UI ✅ Task 8 | Task 8 |
| 20 | Spec build/validate/enrich seed agents | SPEC-016 | ⛔ | — |
| 21 | Knowledge engine (ingest/chunk/embed/search) | SPEC-004 | ✅ FTS5+vector search | FIX-002 |
| 22 | Knowledge benchmark (retrieval eval) | SPEC-004 | ⛔ removido intencionalmente | FIX-031 |

## Sistema & Infra (18)

| # | Funcionalidade | SPEC | Status | Commit/FIX |
|---|---|---|---|---|
| 23 | Scheduler (cron + review queue) | SPEC-009 | ✅ engine DI + review queue + UI | FIX-018 |
| 24 | Tasks page (kanban + calendar) | SPEC-009 | ✅ kanban+DnD ✅; calendar ✅ Task 12 | FIX-009; Task 12 |
| 25 | Telegram bridge | SPEC-010 | ✅ OrchestratorChatAdapter real | FIX-014 |
| 26 | Auth (bcrypt + TOTP + auto-lock + middleware) | SPEC-001 | ✅ middleware.ts + layout verify-assinatura | FIX-007 |
| 27 | Vault (segredos via keytar) | SPEC-011 | ✅ CRUD via keytar | FIX-007 |
| 28 | Rules page | SPEC-021 | ✅ CRUD backend + UI | FIX-004 |
| 29 | Memory page | SPEC-015 | 🟡 schema ✅; UI básica | — |
| 30 | Usage page (token cost analytics) | SPEC-018 | ✅ charts + budget banner | FIX-032 |
| 31 | Logs page (system logs filtráveis) | SPEC-019 | ✅ LogViewer + SSE stream | — |
| 32 | Permissions page | SPEC-020 | 🟡 CRUD backend + UI básica | — |
| 33 | Channels page (Telegram) | SPEC-010 | 🟡 pairing UI; gerenciamento parcial | — |
| 34 | Excalidraw inline no chat | SPEC-002 | ⛔ | — |
| 35 | CodeBurn (terminal PTY) | SPEC-017 | ✅ TerminalPage + pty/server.ts | — |
| 36 | Artifact detection (tool results) | SPEC-002 | ⛔ | — |
| 37 | Pipeline report (relatório final) | SPEC-006 | ⛔ | — |
| 38 | Audit log (todas tool calls) | SPEC-020 | 🟡 schema+port ✅; sem UI | FIX-027 |
| 39 | Auto-update (electron-updater) | SPEC-012 | ✅ | FIX-010 |
| 40 | Pricing calculator (multi-fonte) | SPEC-018 | ⛔ | — |

## MCPs Externos (15 + 3 internos)

| # | MCP | Status |
|---|---|---|
| 41–44 | Google Calendar/Gmail/Drive/Sheets | ✅ catalog seed |
| 45 | ElevenLabs (TTS) | ✅ catalog |
| 46 | Excalidraw (drawing) | ✅ catalog |
| 47 | Knowledge base (search) | ✅ bridge real |
| 48 | Memory search | ✅ catalog |
| 49 | Local agents | ✅ catalog |
| 50 | Local LLM (Ollama) | ✅ |
| 51 | Skills | ✅ bridge real |
| 52 | YouTube (transcript) | ✅ catalog |
| 53 | Shopify | ✅ catalog |
| 54 | Nano-banana (Cohere) | ✅ catalog |
| 55 | Graph search | ✅ bridge real |
| int | wolfkrow-agents/skills/user-question | ✅ 3 internos |

## Providers AI (não mapeados originalmente)

| Provider | Status |
|---|---|
| Anthropic (claude-*) | ✅ AnthropicProvider |
| OpenAI (gpt-*, o1-*, o4-*) | ✅ CodexProvider |
| Ollama (llama-*, qwen-*, etc.) | ✅ CodexProvider c/ baseURL |
| OpenRouter (openrouter/*, google/*, groq/*, mistral/*, together/*) | ✅ Task 6 |
| Custom OpenAI-compatible | ✅ Task 6 — LionProviderConfig.customBaseUrl |
| Google (gemini-*) | ⛔ stub — usar openrouter/ prefix |
| Groq direto | ⛔ stub — usar openrouter/ prefix |

## Navegação / Estrutura

| Item | Status |
|---|---|
| Sidebar /mcp link | ✅ CORRIGIDO → /mcp-servers (Task 1) |
| Sidebar /settings link | ✅ página criada (Task 7) |
| Migrador LionClaw→Wolfkrow | ✅ scripts/migrate-lionclaw.ts |
| PWA / Service Worker | ✅ SW + manifest + icons |
| Electron wrapper + auto-update | ✅ |

## Gaps de Segurança (auditoria original G1-G9)

| Gap | Status |
|---|---|
| G1 Sem middleware.ts | ✅ RESOLVIDO — middleware.ts + layout getSession |
| G2 Worker JWKS efêmero | ✅ RESOLVIDO — createRemoteJWKSet + keypair persistente |
| G3 AIProvider sem streaming | ✅ RESOLVIDO — query() AsyncIterable |
| G4 Regra de negócio no agent-executor | 🟡 temp/model externalizados |
| G5 Worker bloqueia no start 18 MCPs | ✅ RESOLVIDO — apenas 3 internos |
| G6 Schemas sem índices | ✅ RESOLVIDO — 35 index() nos schemas Drizzle |
| G7 MCP manager sem JSON-RPC real | ✅ RESOLVIDO — stdio JSON-RPC |
| G8 web/worker não dependem de domain | ✅ RESOLVIDO — Clean Arch completo |
| G9 Catalog aponta MCPs não migrados | ✅ RESOLVIDO — 3 reais + PLANNED list |

---

## Resumo de cobertura (reconciliado 2026-06-22)

| | Quantidade |
|---|---|
| Funcionalidades mapeadas | 55 + providers + infra |
| ✅ Feito (após Tasks 1-12) | ~42 |
| 🟡 Parcial | ~8 |
| ⛔ Não iniciado (out-of-scope v1) | ~5 |
| Bugs de navegação corrigidos | 2/2 |
| Gaps de segurança resolvidos | 8/9 |
