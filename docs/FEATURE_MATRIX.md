# Wolfkrow Tool — Feature Matrix (Rastreabilidade as-is)

> Mapeia **as 55 funcionalidades do LionClaw v3.0** → SPEC → Fase do plano → status atual.
> Objetivo: garantir **paridade funcional 100%** (nada perdido). Coluna "Status" reflete o estado em **2026-06-22**.
>
> Legenda status: ✅ feito · 🟡 parcial/placeholder · ⛔ não iniciado · 🆕 gap recém-incluído no plano v2.

---

## Chat & Orquestração (15)

| # | Funcionalidade | SPEC | Fase | Status |
|---|---|---|---|---|
| 1 | Chat multi-SDK (Claude Agent, Claude-compat, Codex, Lion) | SPEC-002 | A.2/A.3 | 🟡 Anthropic/Codex/Ollama via LionProvider; streaming SSE ✅ |
| 2 | Onboarding c/ escolha de SDK (wizard) | SPEC-001 | A.1 | ⛔ |
| 3 | Sub-agentes CRUD + runtime + sync massa | SPEC-013 🆕 | N.1 | ✅ CRUD ✅ runtime (FIX-005) ✅ prompt injection (FIX-004) |
| 4 | Skills (editor markdown+frontmatter) | SPEC-014 🆕 | N.2 | ✅ CRUD ✅ injection (FIX-016) |
| 5 | MCP servers (lifecycle start/stop/restart, discovery) | SPEC-008 | N.3 | ✅ 3 servidores internos (FIX-006) ✅ tools/list + tools/call HTTP (FIX-017) |
| 6 | Memory pipeline (compaction/daily/semantic) | SPEC-015 🆕 | N.5 | ✅ pipeline wired (FIX-012) ✅ semantic memory |
| 7 | Dreaming (idle + turn) | SPEC-015 🆕 | N.5 | ✅ DreamingGateRegistry (FIX-013) |
| 8 | Session management (criar/listar/arquivar/deletar/compactar) | SPEC-002 | A.3 | 🟡 in-memory sessions; persistência parcial |
| 9 | Title generation automático | SPEC-002 | A.3 | ⛔ |
| 10 | Confirm dialog (permissões destrutivas) | SPEC-002 | A.3 | ⛔ |
| 11 | Ask user question (estruturada) | SPEC-002 | A.3 | ⛔ |
| 12 | Voice conversation (VAD/barge-in) | SPEC-003 | B.4 | ✅ wired ao chat (FIX-011) |
| 13 | STT (Whisper local / OpenAI) | SPEC-003 | B.4 | 🟡 hooks existem, provider integrado |
| 14 | TTS (ElevenLabs / Cartesia) | SPEC-003 | B.4 | ✅ factory TTS selecionável (FIX-030) |
| 15 | Voice orb UI | SPEC-003 | B.4 | ✅ VoiceOrb renderizado no chat (FIX-011) |

## Build & Automação (7)

| # | Funcionalidade | SPEC | Fase | Status |
|---|---|---|---|---|
| 16 | Harness (Planner→Coder→Evaluator, sprints/rounds/métricas) | SPEC-005 | B.1 | 🟡 schema ✅ vertical-slice domain+infra+use-cases; sem rotas/UI |
| 17 | Pipeline (BuildPlan multi-fase) | SPEC-006 | B.2 | 🟡 schema ✅ vertical-slice; sem UI/relatório final |
| 18 | Open Design Studio (sidecar Next.js) | SPEC-007 | S.6 | ⛔ fora do escopo v1 (FIX-024: vendor/ vazio) |
| 19 | Enrich pipeline (Validator→Enricher) | SPEC-016 🆕 | B.3 | 🟡 schema ✅ vertical-slice; sem UI |
| 20 | Spec build/validate/enrich agents (seed) | SPEC-016 🆕 | N.2/B.3 | ⛔ |
| 21 | Knowledge engine (ingest/chunk/embed/search) | SPEC-004 | N.4 | ✅ ingest/embed/FTS5/vector search (FIX-002) |
| 22 | Knowledge benchmark (retrieval eval) | SPEC-004 | N.4 | ⛔ tabela removida (FIX-031) |

## Sistema & Infra (18)

| # | Funcionalidade | SPEC | Fase | Status |
|---|---|---|---|---|
| 23 | Scheduler (cron + review + kanban/calendar) | SPEC-009 | N.6 | ✅ engine DI ✅ review queue + UI (FIX-018) 🟡 sem calendar |
| 24 | Tasks page (kanban/calendar) | SPEC-009 | N.6/S.4 | ✅ kanban + DnD (FIX-009) 🟡 sem calendar |
| 25 | Telegram bridge (bot conversacional) | SPEC-010 | B.5 | ✅ routing real via OrchestratorChatAdapter (FIX-014) |
| 26 | Auth (bcrypt + TOTP + auto-lock) | SPEC-001 | A.1 | 🟡 bcrypt ✅ TOTP ✅ keypair 🟡 sem middleware auth-gate (G1) |
| 27 | Vault (segredos via keytar) | SPEC-011 | S.1 | ✅ CRUD via keytar + DI (FIX-007) |
| 28 | **Rules page (rules globais editáveis)** | SPEC-021 🆕 | S.3 | ✅ CRUD backend (FIX-004) 🟡 UI básica |
| 29 | Memory page | SPEC-015 🆕 | N.5 | 🟡 schema ✅ sem UI dedicada |
| 30 | Usage page (token cost analytics) | SPEC-018 🆕 | S.2 | ✅ charts + budget banner (FIX-032) |
| 31 | Logs page (system logs filtráveis) | SPEC-019 🆕 | S.3 | ⛔ |
| 32 | Permissions page (whitelist/blacklist tools) | SPEC-020 🆕 | S.3 | 🟡 CRUD backend ✅ UI básica |
| 33 | Channels page (gerenciar Telegram) | SPEC-010 | S.4 | 🟡 pairing UI; sem gerenciamento de canais |
| 34 | Excalidraw inline no chat | SPEC-002 | A.3 | ⛔ |
| 35 | CodeBurn (terminal PTY) | SPEC-017 🆕 | B.5 | ⛔ |
| 36 | Artifact detection (tool results) | SPEC-002 | A.3 | ⛔ |
| 37 | Pipeline report (relatório final) | SPEC-006 | B.2 | ⛔ |
| 38 | Audit log (todas tool calls) | SPEC-020 🆕 | S.3 | 🟡 schema ✅ port ✅ (FIX-027) sem UI |
| 39 | Auto-update (electron-updater) | SPEC-012 | D.2 | ✅ electron-updater wired (FIX-010) |
| 40 | Pricing calculator (multi-fonte) | SPEC-018 🆕 | S.2 | ⛔ |

## MCPs externos (18) — todos em SPEC-008 / Fase N.3

| # | MCP | Status seed |
|---|---|---|
| 41–44 | Google Calendar/Gmail/Drive/Sheets | ✅ catalog |
| 45 | ElevenLabs (TTS) | ✅ |
| 46 | Excalidraw (drawing) | ✅ |
| 47 | Knowledge base (search) | ✅ bridge real (FIX-006) |
| 48 | Memory search | ✅ catalog |
| 49 | Local agents | ✅ catalog |
| 50 | Local LLM (Ollama) | ✅ |
| 51 | Skills | ✅ bridge real (FIX-006) |
| 52 | YouTube (transcript) | ✅ catalog |
| 53 | Shopify | ✅ catalog |
| 54 | Nano-banana (Cohere) | ✅ catalog |
| 55 | Graph search | ✅ bridge real (FIX-006) |
| (int) | wolfkrow-agents/skills/user-question | ✅ 3 internos com tools/list + tools/call |

---

## Itens estruturais adicionais

| Item | Fase | Status |
|---|---|---|
| `packages/domain` (Clean Arch) | F.2 | ✅ (FIX-007/008/027) |
| `packages/use-cases` + DI | F.3 | ✅ container completo (FIX-007) |
| Repos: ports + implementações | F.3 | ✅ 23+ repos com ports no domain (FIX-027) |
| ESLint complexity/god-class rules | F.1 | ✅ 0 erros (FIX-034/015) |
| AIProvider streaming (AsyncIterable) | F.4 | ✅ `query()` + `complete()` |
| JWT keypair persistente | F.4 | 🟡 implementado mas sem middleware auth-gate (G1) |
| MCP bridge JSON-RPC | N.3 | ✅ 3 servidores stdio + HTTP bridge (FIX-006/017) |
| Migrador de dados LionClaw→Wolfkrow | D.1 | ⛔ |
| Electron wrapper + auto-update | D.2 | ✅ deps + autoUpdater (FIX-010) |
| Sidecar Open Design | S.6 | ⛔ fora do escopo v1 (FIX-024) |
| PWA / Service Worker + ícones | D.3 | ✅ SW + manifest + icons (FIX-025) |
| ADR-0026 Cenário A vs B | F (doc) | ✅ criado |
| ADR-0027 Workflow vivo/morto | B.3 (doc) | ✅ Aceito — VIVO (FIX-022) |
| `as unknown as` helpers (json-field) | F.3 | ✅ fromJson/asJsonField (FIX-021) |
| Temperature/maxTokens DI (executor) | N.6 | ✅ AgentExecutorOptions (FIX-026) |

## Gaps de auditoria profunda

| # | Gap | Severidade | Corrige em | Status |
|---|---|---|---|---|
| G1 | Sem `middleware.ts` — rotas `(app)/*` sem auth-gate | P0 segurança | A.1 | ⛔ |
| G2 | Worker confia em JWKS de keypair efêmero (URL hardcoded) | P0 segurança | F.4 | ⛔ |
| G3 | `AIProvider` sem streaming (`query`/`countTokens`) | P0 | F.4/A.2 | ✅ `query()` implementado |
| G4 | Regra de negócio no `agent-executor` (deve ser use-case) | P1 | N.6 | 🟡 temperature/model externalizados (FIX-026) |
| G5 | Worker bloqueia no start sequencial de 18 MCPs | P1 | N.3 | ✅ apenas 3 internos seedados (FIX-006) |
| G6 | Schemas Drizzle sem índices (table-scan) | P1 | F.4+ | ⛔ |
| G7 | MCP manager sem handshake JSON-RPC; restart recursivo sem backoff | P1 | N.3 | ✅ stdio JSON-RPC real (FIX-006) |
| G8 | web/worker não dependem de domain/use-cases (Clean Arch furada) | P0 | F.2/F.3 | ✅ Clean Arch completo (FIX-007) |
| G9 | Catalog aponta MCP servers não migrados do LionClaw | P1 | N.3 | ✅ 3 reais + PLANNED list (FIX-006) |

---

## Resumo de cobertura (2026-06-22)

| | Quantidade |
|---|---|
| Funcionalidades LionClaw (as-is) | 55 |
| Status ✅ (feito) | ~28 |
| Status 🟡 (parcial) | ~14 |
| Status ⛔ (não iniciado) | ~13 |
| Gaps (G1-G9) resolvidos | 6/9 (G1, G2, G6 pendentes) |
| Itens estruturais concluídos | 12/15 |

**Conclusão v1.0**: features de core (chat, voice, memory, dreaming, MCP, skills, rules, tasks, scheduler-review, telegram, knowledge) conectadas. Pendências principais: auth middleware (G1/G2), calendar view, chat dialogs (Confirm/Ask/Title), DB indexes (G6).
