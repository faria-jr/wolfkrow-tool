# Wolfkrow Tool — Feature Matrix (Rastreabilidade reconciliada)

> Reconciliado em 2026-06-25 contra código real (Tasks 13–29 + M1–M8 + Sprint 3-7 P2-1..P2-9, FE-4/FE-7, security sweeps, P3-2/P3-4).
> Legenda: ✅ feito · 🟡 parcial/placeholder · ⛔ não iniciado/descoped v1

---

## v2 (2026-06-26) — `mvp_final_plan_v2.md`

Status deltas vs reconciliation above. Cada linha referencia commit + EPIC do plano v2.

| Item                                                        | Antes       | Agora                                                          | Evidência                                                                   |
| ----------------------------------------------------------- | ----------- | -------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Chat sem agente — erro FK                                   | ⛔ quebrado | ✅ corrigido                                                   | `chat_sessions.agent_id` nullable + SET NULL (`f386500`, EPIC 0.1)          |
| Chat sem agente — SDK GLM/Kimi/MiniMax/Qwen roteando errado | ⛔ quebrado | ✅ corrigido                                                   | `inferProvider` → `claude-compat:<id>` (`b8f0a8f`, EPIC 0.2)                |
| Provider override duplicando ao renomear                    | 🟡          | ✅ corrigido                                                   | `id` locked em edit mode (`75da3cd`, EPIC 0.3)                              |
| Provider edit sem `apiKey` (campo vazio)                    | 🟡          | ✅ corrigido                                                   | `hasApiKey` flag + UX preserve (`f5e3ad8`, EPIC 0.4)                        |
| MCP catch silencioso ("lista vazia" em falha real)          | 🟡          | ✅ corrigido                                                   | error state separado (`a64beb6`, EPIC 0.5)                                  |
| Isolamento por usuário no worker                            | 🟡          | ✅ corrigido                                                   | owner-rewrite em `apps/worker/src/plugins/auth.ts:58` (`b87d3e1`, EPIC 0.6) |
| Agents edit — modal sem markdown                            | 🟡          | ✅ tela dedicada + MarkdownEditor                              | `dfe1b57` (EPIC 1.1)                                                        |
| Agents new — modal                                          | 🟡          | ✅ tela dedicada                                               | `fa3c1cc` (EPIC 1.1 polish)                                                 |
| Skills edit — não-MarkdownEditor                            | 🟡          | ✅ MarkdownEditor + tela dedicada                              | `60c3f54` (EPIC 1.2)                                                        |
| Rules edit — sem EDIT                                       | 🟡          | ✅ tela dedicada + MarkdownEditor                              | `60c3f54` (EPIC 1.3)                                                        |
| MCP edit — sem edit                                         | 🟡          | ✅ tela dedicada                                               | `32bc59d` (EPIC 1.4)                                                        |
| Channel config — só Telegram funcional, sem tela            | 🟡          | ✅ tabela com Telegram funcional + estrutura p/ novos          | `89b00ed` (EPIC 1.6)                                                        |
| Pipeline sem project path                                   | 🟡          | ✅ campo project path com allowlist                            | `b986724` (EPIC 2.2) + migration 0010                                       |
| Run consoles harness/pipeline — inline                      | 🟡          | ✅ full-screen RunConsole                                      | `f2f5ffe` (pipeline) + `072187c` (harness) (EPIC 2.1)                       |
| Dashboard KPIs ignoram chat + runtime split                 | 🟡          | ✅ usage summary + byRuntime + bySource                        | `c2d293b` (runtime split) + `43ab9cf` (dashboard) (EPIC 2.3a + 2.3d)        |
| Pipeline phase sem cost field                               | 🟡          | ✅ `PhaseMetrics.cost` + `RunPhaseUseCase` calcula via pricing | `f14c381` (EPIC 2.3b)                                                       |
| Shared RoundMetrics sem coder/evaluator split               | 🟡          | ✅ schema carrega coderTokens + evaluatorTokens                | `b52532e` (EPIC 2.3c)                                                       |
| Dashboard double-title (Topbar + inline h1)                 | 🟡          | ✅ só Topbar breadcrumb                                        | `bd67edf` (EPIC 3.1a)                                                       |
| Memory/Scheduler/Enrich com inline h1 inconsistente         | 🟡          | ✅ PageHeader uniforme                                         | `8892888` (EPIC 3.1b)                                                       |
| Settings hub duplicando 8/10 destinos do sidebar            | 🟡          | ✅ hub só orphan routes (Providers + Voice + shortcut Vault)   | `3c4ba4c` (EPIC 3.2)                                                        |
| Sidecar Design Studio UI — placeholder 22 linhas            | ⛔          | ✅ UI funcional com daemon status + start/stop                 | `d2fde82` + proxy `33c5428` (EPIC 4.1)                                      |

**Não alterado em v2** (continua conforme reconciliação 2026-06-25): todas as features ✅ mantidas; nenhum item regrediu.

**Débitos tracked em v2** (não bloqueantes):

1. `packages/design-tools` package consolidation (LionClaw port, multi-dia)
2. Infra coverage: `memory-tool.ts`, `skill-tool.ts`, `web-tool.ts` em 0%
3. 11 lint errors pré-existentes (max-lines-per-function, arbitrary `max-w-[Nch]`)
4. Smoke E2E Playwright specs existem (`apps/web/e2e/`) mas não foram executados headless nesta sessão
5. `wolfkrow-audit` (4 auditores) não executado — fan-out pesado, fora do gate

---

## Chat & Orquestração (15)

| #   | Funcionalidade                                        | SPEC     | Status                                                                                                                                                                                                                                        | Commit/FIX                          |
| --- | ----------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| 1   | Chat multi-SDK (Anthropic/Codex/Ollama/LionProvider)  | SPEC-002 | ✅                                                                                                                                                                                                                                            | FIX-005/007                         |
| 2   | Onboarding c/ escolha de SDK (wizard)                 | SPEC-001 | 🟡 setup senha ✅; escolha SDK ✅ reconciliamento Task 9                                                                                                                                                                                      | Task 9                              |
| 3   | Sub-agentes CRUD + runtime + sync massa               | SPEC-013 | ✅                                                                                                                                                                                                                                            | FIX-004/005                         |
| 4   | Skills (editor markdown+frontmatter)                  | SPEC-014 | ✅                                                                                                                                                                                                                                            | FIX-016                             |
| 5   | MCP servers (lifecycle start/stop/restart, discovery) | SPEC-008 | ✅ 15 built-in (M3.3 entregou 9: google-drive, google-sheets, elevenlabs, excalidraw, memory-search, local-agents, local-llm, shopify, nano-banana); custom create ✅ Task 10; remote MCPs (Higgsfield, Blotato) deferidos para v2 (ADR-0031) | FIX-006/017; Task 10; Task 27; M3.3 |
| 6   | Memory pipeline (compaction/daily/semantic)           | SPEC-015 | ✅                                                                                                                                                                                                                                            | FIX-012                             |
| 7   | Dreaming (idle + turn)                                | SPEC-015 | ✅                                                                                                                                                                                                                                            | FIX-013                             |
| 8   | Session management (criar/listar/arquivar/deletar)    | SPEC-002 | 🟡 in-memory; persistência parcial                                                                                                                                                                                                            | —                                   |
| 9   | Title generation automático                           | SPEC-002 | ✅ deriveTitle() no chat-view                                                                                                                                                                                                                 | FIX-028                             |
| 10  | Confirm dialog (permissões destrutivas)               | SPEC-002 | ✅ ConfirmDialog component                                                                                                                                                                                                                    | FIX-028                             |
| 11  | Ask user question (estruturada)                       | SPEC-002 | ✅ AskQuestionDialog component                                                                                                                                                                                                                | FIX-028                             |
| 12  | Voice conversation (VAD/barge-in)                     | SPEC-003 | ✅                                                                                                                                                                                                                                            | FIX-011                             |
| 13  | STT (Whisper local / OpenAI)                          | SPEC-003 | ✅ subprocess local + OpenAI API fallback                                                                                                                                                                                                     | FIX-011; Task 28                    |
| 14  | TTS (ElevenLabs / Cartesia)                           | SPEC-003 | ✅ factory TTS selecionável                                                                                                                                                                                                                   | FIX-030                             |
| 15  | Voice orb UI                                          | SPEC-003 | ✅ VoiceOrb no chat                                                                                                                                                                                                                           | FIX-011                             |

## Build & Automação (7)

| #   | Funcionalidade                                             | SPEC     | Status                                                                                          | Commit/FIX         |
| --- | ---------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------- | ------------------ |
| 16  | Harness (Planner→Coder→Evaluator, sprints/rounds/métricas) | SPEC-005 | 🟡 domain+infra+use-cases+UI ✅; DiffViewer rounds ✅ (M5.3); sem execução AI automática (v1.1) | M5.3               |
| 17  | Pipeline (BuildPlan multi-fase)                            | SPEC-006 | 🟡 domain+infra+routes+UI ✅; templates nomeados ✅ Task 11                                     | Task 11            |
| 18  | Open Design Studio (sidecar Next.js)                       | SPEC-007 | ✅ apps/sidecar + DesignStudio iframe embed                                                     | S.6 commit 1329c87 |
| 19  | Enrich pipeline (Validator→Enricher)                       | SPEC-016 | 🟡 API backend ✅; UI ✅ Task 8                                                                 | Task 8             |
| 20  | Spec build/validate/enrich seed agents                     | SPEC-016 | ⛔                                                                                              | —                  |
| 21  | Knowledge engine (ingest/chunk/embed/search)               | SPEC-004 | ✅ keyword LIKE + JS cosine similarity (O(n)); roadmap: sqlite-vec vec0                         | FIX-002; ADR-0028  |
| 22  | Knowledge benchmark (retrieval eval)                       | SPEC-004 | ⛔ removido intencionalmente                                                                    | FIX-031            |

## Sistema & Infra (18)

| #   | Funcionalidade                                | SPEC     | Status                                                                                                                                                               | Commit/FIX       |
| --- | --------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| 23  | Scheduler (cron + review queue)               | SPEC-009 | ✅ engine DI + review queue + UI                                                                                                                                     | FIX-018          |
| 24  | Tasks page (kanban + calendar)                | SPEC-009 | ✅ kanban+DnD ✅; calendar ✅ Task 12                                                                                                                                | FIX-009; Task 12 |
| 25  | Telegram bridge                               | SPEC-010 | ✅ OrchestratorChatAdapter real                                                                                                                                      | FIX-014          |
| 26  | Auth (bcrypt + TOTP + auto-lock + middleware) | SPEC-001 | ✅ middleware.ts + layout verify-assinatura                                                                                                                          | FIX-007          |
| 27  | Vault (segredos via keytar)                   | SPEC-011 | ✅ CRUD via keytar                                                                                                                                                   | FIX-007          |
| 28  | Rules page                                    | SPEC-021 | ✅ CRUD backend + UI                                                                                                                                                 | FIX-004          |
| 29  | Memory page                                   | SPEC-015 | ✅ schema ✅; Summaries tab ✅ (M6.1); Compact Now ✅ (M6.1); search UI ✅ — `MemorySearchTab` (`components/memory/memory-body.tsx:87`) + `/api/memory/search` route | M6.1; P3-3       |
| 30  | Usage page (token cost analytics)             | SPEC-018 | ✅ charts + budget banner                                                                                                                                            | FIX-032          |
| 31  | Logs page (system logs filtráveis)            | SPEC-019 | ✅ LogViewer + SSE stream                                                                                                                                            | —                |
| 32  | Permissions page                              | SPEC-020 | 🟡 CRUD backend + UI básica                                                                                                                                          | —                |
| 33  | Channels page (Telegram)                      | SPEC-010 | 🟡 pairing UI; gerenciamento parcial                                                                                                                                 | —                |
| 34  | Excalidraw inline no chat                     | SPEC-002 | ⛔                                                                                                                                                                   | —                |
| 35  | CodeBurn (terminal PTY)                       | SPEC-017 | ✅ TerminalPage + pty/server.ts                                                                                                                                      | —                |
| 36  | Artifact detection (tool results)             | SPEC-002 | ✅ `detectArtifact()` (`components/chat/artifact-detector.ts`) + `ArtifactCard` render; wired via SSE `onArtifact` (`chat-hooks.ts:110`)                             | P3-3             |
| 37  | Pipeline report (relatório final)             | SPEC-006 | ✅ `PipelineReportView` (markdown, `components/pipeline/pipeline-report-view.tsx`) + worker route `GET /projects/:id/report` (`GeneratePipelineReportUseCase`)       | P3-3             |
| 38  | Audit log (todas tool calls)                  | SPEC-020 | 🟡 schema+port ✅; tabela UI ✅; CSV/JSON export ✅ (M6.4); filtros avançados ⛔ v1.1                                                                                | FIX-027; M6.4    |
| 39  | Auto-update (electron-updater)                | SPEC-012 | ✅                                                                                                                                                                   | FIX-010          |
| 40  | Pricing calculator (multi-fonte)              | SPEC-018 | ✅ `PricingCalculatorCard` (`components/usage/pricing-calculator-card.tsx`) montado no Usage page (`app/(app)/usage/page.tsx:15`)                                    | P3-3             |

## MCPs — binários reais vs catalog planejado

### Built-in (binário real em packages/mcp-servers/)

| #   | MCP                            | Status                   |
| --- | ------------------------------ | ------------------------ |
| 47  | Knowledge base (search)        | ✅ binary real           |
| 51  | wolfkrow-skills                | ✅ binary real           |
| 52  | YouTube (search + transcript)  | ✅ binary real (Task 27) |
| 55  | Graph search                   | ✅ binary real           |
| 41  | Google Calendar                | ✅ binary real (Task 27) |
| 42  | Google Gmail                   | ✅ binary real (Task 27) |
| 43  | Google Drive                   | ✅ binary real (M3.3)    |
| 44  | Google Sheets                  | ✅ binary real (M3.3)    |
| 45  | ElevenLabs (TTS)               | ✅ binary real (M3.3)    |
| 46  | Excalidraw (drawing)           | ✅ binary real (M3.3)    |
| 48  | Memory search                  | ✅ binary real (M3.3)    |
| 49  | Local agents (wolfkrow-agents) | ✅ binary real (M3.3)    |
| 50  | Local LLM (Ollama)             | ✅ binary real (M3.3)    |
| 53  | Shopify                        | ✅ binary real (M3.3)    |
| 54  | Nano-banana                    | ✅ binary real (M3.3)    |

### Deferred to v2 (ver ADR-0031)

| #   | MCP                      | Status                                                                     |
| --- | ------------------------ | -------------------------------------------------------------------------- |
| int | Higgsfield (image/video) | ⛔ deferido para v2 (OAuth browser flow incompatível com worker Node-only) |
| int | Blotato (social posting) | ⛔ deferido para v2 (caso de uso narrow, rate-limit-sensitive)             |
| int | wolfkrow-user-question   | ⛔ deferido para v2 (sem demanda registrada)                               |

## Providers AI (não mapeados originalmente)

| Provider                                                            | Status                                       |
| ------------------------------------------------------------------- | -------------------------------------------- |
| Anthropic (claude-\*)                                               | ✅ AnthropicProvider                         |
| OpenAI (gpt-_, o1-_, o4-\*)                                         | ✅ CodexProvider                             |
| Ollama (llama-_, qwen-_, etc.)                                      | ✅ CodexProvider c/ baseURL                  |
| OpenRouter (openrouter/_, google/_, groq/_, mistral/_, together/\*) | ✅ Task 6                                    |
| Custom OpenAI-compatible                                            | ✅ Task 6 — LionProviderConfig.customBaseUrl |
| Google (gemini-\*)                                                  | ⛔ stub — usar openrouter/ prefix            |
| Groq direto                                                         | ⛔ stub — usar openrouter/ prefix            |

## Navegação / Estrutura

| Item                           | Status                               |
| ------------------------------ | ------------------------------------ |
| Sidebar /mcp link              | ✅ CORRIGIDO → /mcp-servers (Task 1) |
| Sidebar /settings link         | ✅ página criada (Task 7)            |
| Migrador LionClaw→Wolfkrow     | ✅ scripts/migrate-lionclaw.ts       |
| PWA / Service Worker           | ✅ SW + manifest + icons             |
| Electron wrapper + auto-update | ✅                                   |

## Gaps de Segurança (auditoria original G1-G9)

| Gap                                   | Status                                                                   |
| ------------------------------------- | ------------------------------------------------------------------------ |
| G1 Sem middleware.ts                  | ✅ RESOLVIDO — middleware.ts + layout getSession                         |
| G2 Worker JWKS efêmero                | ✅ RESOLVIDO — createRemoteJWKSet + keypair persistente                  |
| G3 AIProvider sem streaming           | ✅ RESOLVIDO — query() AsyncIterable                                     |
| G4 Regra de negócio no agent-executor | 🟡 temp/model externalizados                                             |
| G5 Worker bloqueia no start 18 MCPs   | ✅ RESOLVIDO — 6 built-in com `visibility: on-demand`; planned sem spawn |
| G6 Schemas sem índices                | ✅ RESOLVIDO — 35 index() nos schemas Drizzle                            |
| G7 MCP manager sem JSON-RPC real      | ✅ RESOLVIDO — stdio JSON-RPC                                            |
| G8 web/worker não dependem de domain  | ✅ RESOLVIDO — Clean Arch completo                                       |
| G9 Catalog aponta MCPs não migrados   | ✅ RESOLVIDO — 6 built-in com binários reais + PLANNED list honesta      |

---

## Funcionalidades descoped para v1.1+

| #   | Feature                                                                                                   | Razão                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| --- | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 16  | Harness — execução AI automática                                                                          | Complexidade de orquestração; fundação entregue em v1.0                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 20  | Spec build/validate/enrich seed agents                                                                    | Depende de harness automático                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 22  | Knowledge benchmark (retrieval eval)                                                                      | Removido intencionalmente (FIX-031; ADR-0032)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 34  | Excalidraw inline no chat                                                                                 | Intencionalmente descoped para v1.1. Em v1.0 o artifact-card abre o diagrama como **link externo** (`https://excalidraw.com/#json=<base64>`, `target="_blank"`) em vez de embed inline — ver `apps/web/components/chat/artifact-card.tsx:71-99`. O MCP Excalidraw (binário real, M3.3) está entregue; apenas a renderização inline no chat é UX extra adiada. Inline embed planejado para v1.1. (P2-7)                                                                                                                                                     |
| 38  | Audit log — filtros avançados                                                                             | Tabela + export ✅ em v1.0; filtros são UX extra                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 11  | Interactive agent clarification (ask-the-user dialog)                                                     | Worker não emite o evento de pergunta clarificadora em v1.0; UI frontend removida para não enviar código morto (mascarado apenas por teste SSE mockado). Planejado para v1.1 com emitter real no worker + canal de resposta round-trip. (P0-3)                                                                                                                                                                                                                                                                                                             |
| —   | mgraph structured vault (ROAM-like: entities/meetings/decisions/projects/references as first-class nodes) | Intencionalmente fora do escopo de v1.0. O LionClaw tinha um vault estruturado ROAM-like (`electron/main/mgraph-engine.ts`); o Wolfkrow **não** portou os tipos de nó estruturados. Em v1.0 a visualização de relações é coberta pela **graph view** (D3 + entity extraction) + MCP Graph search (binário real, row 55), que atendem ao caso de uso de visualização de relações sem a complexidade de um schema estruturado. Decisão registrada em ADR-0033. Reverte para implementação (Decision A) se ≥ 3 usuários pedirem os tipos estruturados. (P2-9) |

---

## Resumo de cobertura (reconciliado 2026-06-25, Tasks 1–29 + M1–M8 + Sprint 3-7)

|                                                  | Quantidade                                                              |
| ------------------------------------------------ | ----------------------------------------------------------------------- |
| Funcionalidades mapeadas                         | 55 + providers + infra                                                  |
| ✅ Feito                                         | ~48                                                                     |
| 🟡 Parcial (core entregue, UI/automação em v1.1) | ~4                                                                      |
| ⛔ Descoped para v1.1+                           | 5                                                                       |
| MCPs com binário real                            | 15                                                                      |
| MCPs deferidos para v2                           | 3 (Higgsfield, Blotato, wolfkrow-user-question)                         |
| Bugs de navegação corrigidos                     | 2/2                                                                     |
| Gaps de segurança resolvidos                     | 9/9 (autenticação em todas as rotas user-scoped + IDOR fix, Sprint 3-7) |
