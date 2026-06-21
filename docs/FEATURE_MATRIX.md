# Wolfkrow Tool — Feature Matrix (Rastreabilidade as-is)

> Mapeia **as 55 funcionalidades do LionClaw v3.0** → SPEC → Fase do plano → status atual.
> Objetivo: garantir **paridade funcional 100%** (nada perdido). Coluna "Status" reflete o estado em 2026-06-20.
>
> Legenda status: ✅ feito · 🟡 parcial/placeholder · ⛔ não iniciado · 🆕 gap recém-incluído no plano v2.

---

## Chat & Orquestração (15)

| # | Funcionalidade | SPEC | Fase | Status |
|---|---|---|---|---|
| 1 | Chat multi-SDK (Claude Agent, Claude-compat, Codex, Lion) | SPEC-002 | A.2/A.3 | 🟡 chat placeholder, só anthropic |
| 2 | Onboarding c/ escolha de SDK (wizard) | SPEC-001 | A.1 | ⛔ |
| 3 | Sub-agentes CRUD + runtime + sync massa | SPEC-013 🆕 | N.1 | ⛔ (schema ✅) |
| 4 | Skills (editor markdown+frontmatter) | SPEC-014 🆕 | N.2 | ⛔ (schema ✅) |
| 5 | MCP servers (lifecycle start/stop/restart, discovery) | SPEC-008 | N.3 | 🟡 spawn sem bridge JSON-RPC |
| 6 | Memory pipeline (compaction/daily/semantic) | SPEC-015 🆕 | N.5 | ⛔ (schema ✅) |
| 7 | Dreaming (idle + turn) | SPEC-015 🆕 | N.5 | ⛔ |
| 8 | Session management (criar/listar/arquivar/deletar/compactar) | SPEC-002 | A.3 | ⛔ (schema ✅) |
| 9 | Title generation automático | SPEC-002 | A.3 | ⛔ |
| 10 | Confirm dialog (permissões destrutivas) | SPEC-002 | A.3 | ⛔ |
| 11 | Ask user question (estruturada) | SPEC-002 | A.3 | ⛔ |
| 12 | Voice conversation (VAD/barge-in) | SPEC-003 | B.4 | ⛔ |
| 13 | STT (Whisper local / OpenAI) | SPEC-003 | B.4 | ⛔ |
| 14 | TTS (ElevenLabs / Cartesia) | SPEC-003 | B.4 | ⛔ |
| 15 | Voice orb UI | SPEC-003 | B.4 | ⛔ |

## Build & Automação (7)

| # | Funcionalidade | SPEC | Fase | Status |
|---|---|---|---|---|
| 16 | Harness (Planner→Coder→Evaluator, sprints/rounds/métricas) | SPEC-005 | B.1 | ⛔ (schema ✅) |
| 17 | Pipeline (BuildPlan multi-fase) | SPEC-006 | B.2 | ⛔ (schema ✅) |
| 18 | Open Design Studio (sidecar Next.js) | SPEC-007 | S.6 | ⛔ |
| 19 | Enrich pipeline (Validator→Enricher) | SPEC-016 🆕 | B.3 | ⛔ (schema ✅) |
| 20 | Spec build/validate/enrich agents (seed) | SPEC-016 🆕 | N.2/B.3 | ⛔ |
| 21 | Knowledge engine (ingest/chunk/embed/search) | SPEC-004 | N.4 | ⛔ (schema ✅) |
| 22 | Knowledge benchmark (retrieval eval) | SPEC-004 | N.4 | ⛔ |

## Sistema & Infra (18)

| # | Funcionalidade | SPEC | Fase | Status |
|---|---|---|---|---|
| 23 | Scheduler (cron + review + kanban/calendar) | SPEC-009 | N.6 | 🟡 engine DI ✅, sem UI/review |
| 24 | Tasks page (kanban/calendar) | SPEC-009 | N.6/S.4 | ⛔ (schema ✅) |
| 25 | Telegram bridge (bot conversacional) | SPEC-010 | B.5 | ⛔ (schema ✅) |
| 26 | Auth (bcrypt + TOTP + auto-lock) | SPEC-001 | A.1 | 🟡 **login fake/keypair efêmero (B1)** |
| 27 | Vault (segredos via keytar) | SPEC-011 | S.1 | ⛔ (schema ✅) |
| 28 | **Rules page (rules globais editáveis)** | SPEC-021 🆕 | S.3 | ⛔ **(era PERDIDA no plano v1)** |
| 29 | Memory page | SPEC-015 🆕 | N.5 | ⛔ |
| 30 | Usage page (token cost analytics) | SPEC-018 🆕 | S.2 | ⛔ (schema ✅) |
| 31 | Logs page (system logs filtráveis) | SPEC-019 🆕 | S.3 | ⛔ |
| 32 | Permissions page (whitelist/blacklist tools) | SPEC-020 🆕 | S.3 | ⛔ |
| 33 | Channels page (gerenciar Telegram) | SPEC-010 | S.4 | ⛔ (schema ✅) |
| 34 | Excalidraw inline no chat | SPEC-002 | A.3 | ⛔ |
| 35 | CodeBurn (terminal PTY) | SPEC-017 🆕 | B.5 | ⛔ |
| 36 | Artifact detection (tool results) | SPEC-002 | A.3 | ⛔ |
| 37 | Pipeline report (relatório final) | SPEC-006 | B.2 | ⛔ |
| 38 | Audit log (todas tool calls) | SPEC-020 🆕 | S.3 | ⛔ (schema ✅) |
| 39 | Auto-update (electron-updater) | SPEC-012 | D.2 | ⛔ |
| 40 | Pricing calculator (multi-fonte) | SPEC-018 🆕 | S.2 | ⛔ |

## MCPs externos (18) — todos em SPEC-008 / Fase N.3

| # | MCP | Status seed |
|---|---|---|
| 41–44 | Google Calendar/Gmail/Drive/Sheets | ✅ catalog |
| 45 | ElevenLabs (TTS) | ✅ |
| 46 | Excalidraw (drawing) | ✅ |
| 47 | Knowledge base (search) | ✅ |
| 48 | Memory search | ✅ |
| 49 | Local agents | ✅ |
| 50 | Local LLM (Ollama) | ✅ |
| 51 | Skills | ✅ |
| 52 | YouTube (transcript) | ✅ |
| 53 | Shopify | ✅ |
| 54 | Nano-banana (Cohere) | ✅ |
| 55 | Graph search | ✅ |
| (int) | wolfkrow-agents/skills/user-question | ✅ (3 internos) |

> **Nota MCP**: LionClaw tinha 18 packages standalone. Seed Wolfkrow já lista os 18 no catalog. Falta o **bridge JSON-RPC real** (N.3) — hoje só há spawn.

---

## Itens estruturais adicionais (não-feature, mas obrigatórios)

| Item | Fase | Status |
|---|---|---|
| `packages/domain` (Clean Arch) | F.2 | ⛔ **não existe** |
| `packages/use-cases` + DI | F.3 | ⛔ **não existe** |
| Repos: ports + base genérica | F.3 | 🟡 só helper scheduler |
| ESLint complexity/god-class rules | F.1 | ⛔ **não aplicado** |
| AIProvider streaming (AsyncIterable) | F.4 | 🟡 só `complete()` |
| JWT keypair persistente (corrige B1) | F.4 | 🟡 efêmero em memória |
| MCP bridge JSON-RPC | N.3 | ⛔ |
| Migrador de dados LionClaw→Wolfkrow | D.1 | ⛔ **novo** |
| Electron wrapper | D.2 | ⛔ |
| Sidecar Open Design | S.6 | ⛔ |
| PWA / Service Worker | D.3 | ⛔ |
| ADR-0026 Cenário A vs B | F (doc) | ✅ criado |
| ADR-0027 Workflow vivo/morto | B.3 (doc) | ✅ criado (proposto) |

## Gaps de auditoria profunda (a corrigir/reimplementar)

| # | Gap | Severidade | Corrige em | Status |
|---|---|---|---|---|
| G1 | Sem `middleware.ts` — rotas `(app)/*` sem auth-gate | P0 segurança | A.1 | ⛔ |
| G2 | Worker confia em JWKS de keypair efêmero (URL hardcoded) | P0 segurança | F.4 | ⛔ |
| G3 | `AIProvider` sem streaming (`query`/`countTokens`) | P0 | F.4/A.2 | 🟡 só `complete()` |
| G4 | Regra de negócio no `agent-executor` (deve ser use-case) | P1 | N.6 | 🟡 |
| G5 | Worker bloqueia no start sequencial de 18 MCPs | P1 | N.3 | 🟡 |
| G6 | Schemas Drizzle sem índices (table-scan) | P1 | F.4+ | ⛔ |
| G7 | MCP manager sem handshake JSON-RPC; restart recursivo sem backoff | P1 | N.3 | 🟡 |
| G8 | web/worker não dependem de domain/use-cases (Clean Arch furada) | P0 | F.2/F.3 | ⛔ |
| G9 | Catalog aponta MCP servers não migrados do LionClaw | P1 | N.3 | ⛔ |

**Login (B1+G1+G2)**: reimplementação completa na Fase A.1 — atual é placeholder inseguro (senha fake, keypair efêmero, sem gate).

---

## Resumo de cobertura

| | Quantidade |
|---|---|
| Funcionalidades LionClaw (as-is) | 55 |
| Cobertas por SPEC após plano v2 | 55 ✅ |
| SPECs existentes | 12 |
| SPECs a criar (gaps fechados) | 10 (013–022) |
| Funcionalidade que estava **perdida** no plano v1 | 1 (Rules page) — **incluída** |
| Schema órfão resolvido | 1 (Workflow → decisão em B.3) |
| Página rebaixada recuperada | 1 (Graph → página dedicada S.5) |

**Conclusão**: com o plano v2, as 55 funcionalidades têm SPEC + fase + testes designados. Paridade as-is = 100% rastreável.
