# Auditoria Profunda Verificada — wolfkrow-tool vs LionClaw

**Data:** 2026-06-24
**Método:** Verificação cética direto no código (`file:line`), execução real de `pnpm test` / `typecheck` / `lint`, comparação 1:1 com `/Users/juniorfaria/projects/lionclawv1.0`.
**Escopo:** Paridade LionClaw → refactor Next.js, funcional, segurança, contratos backend↔frontend, clean code/arch/SOLID/DRY/YAGNI, testes, UI/UX.

> Esta auditoria **confirma** a maior parte de `AUDITORIA_GERAL_2026-06-24.md`, mas **refuta um achado central** (seed agents) e **reclassifica** outro. Diferenças destacadas em ⚠️.

---

## 0. Estado de build (executado, não inferido)

| Comando | Resultado |
|---|---|
| `pnpm test` | ✅ exit 0 — todos verdes (web: 75 files / 371 tests; demais cacheados FULL TURBO) |
| `pnpm typecheck` | ✅ exit 0 — 30 tasks, zero erro TS |
| `pnpm lint` | ✅ exit 0 |

Build sólido. Nenhum teste falhando. **Mas** o verde esconde thresholds lenientes (§5).

---

## 1. Funcionalidade LionClaw NÃO mapeada?

Comparação de superfície (19 páginas LionClaw / 19 stores / 19 MCP servers / 70 seed agents) vs wolfkrow:

- **Páginas:** 100% cobertas. Todas as 19 páginas LionClaw têm rota equivalente em `apps/web/app/(app)/` (`agents`=SubAgents, `design`=OpenDesignStudio).
- **MCP servers:** LionClaw 19 dirs → wolfkrow 16. Faltam **3 dirs duplicados/intencionais**: `lionclaw-user-question` (deferido v2, ADR-0031 — OK), e `lionclaw-skills`/`skills` + `lionclaw-agents`/`local-agents` foram **consolidados** em `wolfkrow-skills`/`local-agents` (sem perda funcional aparente).
- **Providers:** LionClaw tinha executors por provider (`zai`, `google-genai`, `minimax`) → consolidados via OpenRouter (MIGRATION_FROM_LIONCLAW.md). Decisão de escopo documentada — **não é gap**.

**Veredito:** Nenhuma funcionalidade de produto ficou **sem mapeamento**. Os "gaps" são consolidações/deferimentos documentados em ADR.

---

## 2. Item mapeado que NÃO foi implementado (ou orfão)

### ⚠️ 2.1 SEED AGENTS — correção do achado anterior

A `AUDITORIA_GERAL` afirmou *"apenas 4-6 seed agents (vs 70+) — maior gap de paridade 🔴 CRÍTICO"*. **Isso está errado nos dois sentidos:**

| Fato verificado | Evidência |
|---|---|
| wolfkrow tem **72 seed agents** YAML migrados | `.wolfkrow/agents/*.yaml` (72 arquivos); nomes batem 1:1 com LionClaw (`backend-developer`, `harness-planner`, `pipe2-*`, `security-*`, etc.) |
| LionClaw tem **68 agents reais** (70 `.ts` − `index.ts`/`ensure.ts`) | `lionclawv1.0/electron/main/seed-agents/*.ts`; `diff` de nomes = só 3 linhas |
| Loader + schema + teste existem e passam | `apps/worker/src/seed-agents/loader.ts`, `schema.ts`, `__tests__/seed-agents.test.ts` (✓ "loads all YAML agents") |

**PORÉM — o achado real (mais grave que o anterior):** o loader é **código órfão**.

```
grep -rn "loadSeedAgents" (repo, excl. node_modules/dist/.git)
→ ÚNICAS referências: loader.ts (def) + seed-agents.test.ts (teste) + SPEC-014.md
→ ZERO chamadores em runtime
```

- `apps/worker/package.json` **não tem** script `seed:agents`, mas a raiz (`package.json:scripts.seed:agents`) delega para `@wolfkrow/worker seed:agents` → **`pnpm seed:agents` falha**.
- Nenhum bootstrap/startup do worker chama `loadSeedAgents`. Nenhum seeder em `packages/infra/src/seed/` insere agents.

**Conclusão:** definições migradas (paridade de dados ✅), mas **em runtime o usuário recebe 0 seed agents**. A funcionalidade "produto já vem com 68 agentes" **não funciona end-to-end**. Severidade: 🔴 **BLOCKER funcional** (loader morto + script quebrado + feature ausente em runtime).
*Fix:* wirear `loadSeedAgents` num seeder idempotente (upsert por nome na tabela `agents`) chamado no startup do worker ou via `seed:agents` real.

### 2.2 Demais itens mapeados não implementados (confirmados)

| Item | Estado | Evidência |
|---|---|---|
| Permissions management UI (SPEC-020) | ❌ placeholder 15 linhas, texto estático "open an agent" | `apps/web/app/(app)/permissions/page.tsx` |
| Config de voz no Settings (STT/TTS) | ❌ ausente — `settings/page.tsx` é hub de links | sem seletor de voz |
| Pricing calculator UI (SPEC-018) | ❌ domínio `pricing-calculator.ts` existe, sem UI/wiring | — |
| Rotas Settings `/settings/{vault,agents,mcp,...}` (8) | ❌ 404 — só `/settings` e `/settings/providers` existem | `settings-shell.tsx:9-17` lista 9 tabs; `find app/settings` = 2 rotas |

### ⚠️ 2.3 FEATURE_MATRIX desatualizada (itens marcados ⛔ que JÁ existem)

| Item na MATRIX | Realidade | Evidência |
|---|---|---|
| Memory search UI ⛔ v1.1 | ✅ existe | `memory-body.tsx:34` aba `'search'` |
| Artifact detection ⛔ | ✅ existe + teste | `apps/web/components/chat/artifact-detector.ts` (+`.test.ts`) |

---

## 3. BLOCKERS de segurança / funcional (verificados file:line)

### 🔴 B1 — SSRF: bypass por IP numérico (decimal/octal/hex)
`packages/domain/src/value-objects/provider-config.ts` valida host por **regex de string** (`/^127\./`, `/^169\.254\./`). Cobre IPv4/IPv6/`[::1]`/mapped, mas **não normaliza** representações numéricas:
- `http://2130706433/` (= 127.0.0.1 decimal) → **passa**
- `http://0177.0.0.1/` (octal) / `http://0x7f000001/` (hex) → **passam**

Permite alcançar metadata interno (ex.: `169.254.169.254`) via provider custom. *Fix:* resolver via `node:dns` e validar IP resolvido, ou normalizar numérico antes do match.

### 🔴 B2 — Evento SSE `ask_question` morto (feature quebrada e2e)
Frontend **completo**: `sse.ts:10,48` (dispatch), `chat-hooks.ts:139` (`pendingQuestion`), `chat-view.tsx:136` (`AskQuestionDialog`), até teste (`chat-view.test.tsx:192`). Mas:
```
grep -rn "ask_question" apps/worker/src → VAZIO
```
O worker **nunca emite** o evento. O teste passa porque **mocka** o SSE — valida o componente, não o fluxo real. Feature "agente pergunta ao usuário" está morta. *Fix:* emitir `ask_question` no loop agêntico do worker (ou remover handler morto).

### 🔴 B3 — `/usage/summary` com 3 shapes incompatíveis
| Camada | Shape | Evidência |
|---|---|---|
| Frontend | `totalInputTokens`/`totalOutputTokens`/`totalCostUSD`/`byDay: Record` | `usage-charts.tsx:20-25` |
| Schema compartilhado | `totalTokens`/`totalCost`/`totalRequests`/`byDay: array` | `shared-types/src/schemas/usage.ts:57-62` |
| Worker | retorna `computeUC.execute(...)` cru, **sem parse/validação** | `apps/worker/src/routes/usage.ts:46` |

Três contratos divergentes para o mesmo endpoint. *Fix:* unificar no schema e `parse()` nos 3 lados.

### 🔴 B4 — Rotas Settings 404 + navegação dupla
`settings-shell.tsx:9-17` aponta 9 tabs; só 2 rotas existem → **7×404**. Coexiste com cards de navegação em `settings/page.tsx` → ambiguidade UX. *Fix:* criar rotas ou remover tabs e consolidar nav.

### 🟠 C2 — Contrato de login quebrado
`LoginResponseSchema` (`shared-types/src/schemas/auth.ts:119-126`) exige `challengeId: UuidSchema` no caso `requires_totp`; o handler retorna `{ status: 'requires_totp', userId }` (`app/api/auth/login/route.ts:78`). Schema ≠ handler. *Fix:* alinhar.

### 🟠 C4 — `/logs/stream` sem autenticação
`apps/worker/src/routes/logs.ts` **não tem** `onRequest: [app.authenticate]`; rotas vizinhas (`knowledge.ts:80,84,94,104`) têm. Logs podem vazar sem sessão. *Fix:* adicionar `app.authenticate`.

---

## 4. Implementado fora dos padrões do projeto

### 4.1 ⚠️ Shadow schemas — viola ADR-0005 (Zod single source of truth)
`packages/shared-types/src/schemas/` tem ~20 schemas Zod, mas o worker importa **só constantes**, nunca os schemas:
```
grep "@wolfkrow/shared-types" apps/worker/src
→ 4 hits, todos DEFAULT_AGENT_MODEL / DEFAULT_CHAT_MODEL (constantes)
```
Nenhum boundary do worker faz `Schema.parse(body)`. Zod existe mas é decorativo. *Fix:* importar e `parse()` nos boundaries (resolve C2/B3 de quebra).

### 4.2 Thresholds de cobertura lenientes — viola `tdd-mandatory` (≥85% backend)
`apps/worker/vitest.config.ts:27-31` → `lines:25 / functions:25 / branches:20 / statements:25`.
Cobertura **real** do worker (executada): **54.7% lines / 78% branch / 60.5% funcs** (`apps/worker/.turbo/turbo-test$colon$cov.log` → `All files 54.7`). CI passa **verde falso**: worker é a camada HTTP crítica (auth, MCP, chat, vault) e está ~30 pontos abaixo da regra.

### 4.3 Outros desvios (reportados pela auditoria anterior — alta plausibilidade)
- shared-types com **0% branch** + threshold 25% → contratos sem teste de branch.
- `knowledge/search` duplicado (route web + route worker morto).
- 4 fontes divergentes de provider/pricing (RM1).
- E2E com `test.skip(()=>false)` morto e assertions fracas (`chat.spec.ts`, `tasks.spec.ts`).

---

## 5. Bugs / débito técnico (resumo verificado)

| Sev | ID | Item | Evidência | Status |
|---|---|---|---|---|
| 🔴 | B-seed | Seed loader órfão / `seed:agents` quebrado / 0 agents em runtime | §2.1 | **confirmado (novo)** |
| 🔴 | B1 | SSRF numeric bypass | provider-config.ts | confirmado |
| 🔴 | B2 | SSE `ask_question` morto | worker grep vazio | confirmado |
| 🔴 | B3 | usage 3 shapes | usage-charts.tsx / usage.ts / route | confirmado |
| 🔴 | B4 | 7 rotas Settings 404 | settings-shell.tsx | confirmado |
| 🟠 | C2 | login schema ≠ handler | auth.ts:126 / login route:78 | confirmado |
| 🟠 | C4 | /logs/stream sem auth | logs.ts | confirmado |
| 🟠 | DRY | shadow schemas | grep shared-types | confirmado |
| 🟡 | Cov | worker 54.7% < 85% | turbo cov log | confirmado |
| 🟡 | M1 | abort não propaga p/ tool | reportado (claude-compat) | plausível, não bloqueei |
| 🟡 | M2 | permission store in-memory perde no restart | reportado | plausível |
| 🟡 | M8 | permissions page placeholder | page.tsx 15 linhas | confirmado |
| 🟡 | M9 | pipeline report markdown como `<pre>` | reportado | plausível |
| 🔵 | — | `bash`/`sh`/`zsh` no `ALLOWED_BINARIES` | reportado | plausível |

---

## 6. Fora de escopo / YAGNI

✅ Sem over-engineering visível. Deferimentos conscientes e documentados em ADR:
- Higgsfield/Blotato MCPs → v2 (ADR-0031).
- Knowledge benchmark → removido (ADR-0032).
- Harness loop AI automático → v1.1 (fundação entregue).
- RAG simplificado (keyword + cosine JS) vs LionClaw (HyDE/rerank/BM25) → ADR-0028.

Nenhum item **fora do escopo** sendo implementado indevidamente.

---

## 7. Otimizações / melhorias

| # | Item | Impacto |
|---|---|---|
| O1 | Wirear seeder de agents (idempotente) + corrigir `seed:agents` | Fecha o BLOCKER de paridade real |
| O2 | `parse()` dos shared schemas em todo boundary (ativa ADR-0005) | Resolve B3/C2 + DRY |
| O3 | SSRF via DNS resolve + normalização numérica | Resolve B1 |
| O4 | Elevar threshold worker → 85% progressivo; testar shared-types branch | Governance tdd-mandatory |
| O5 | Emitir `ask_question` no worker OU remover handler morto | Resolve B2 |
| O6 | Consolidar provider/pricing em fonte única | DRY (RM1) |
| O7 | sqlite-vec/vec0 p/ busca vetorial (hoje cosine JS O(n), não escala >5k chunks) | Performance RAG |
| O8 | Frontend: criar rotas Settings, permissions CRUD, pricing UI, config de voz, ReactMarkdown no report, SidebarTrigger mobile | Fecha lacunas UX |
| O9 | Reconciliar FEATURE_MATRIX (memory-search/artifact já feitos) + IMPLEMENTATION_PLAN ("5%" irreal) | Manutenibilidade |

---

## 8. Checklist do usuário — veredito por critério

| Critério | Veredito | Nota |
|---|---|---|
| Item realmente implementado | 🟡 | Maioria sim; seed agents migrados mas **não seedados em runtime**; pricing/permissions-UI/config-voz ausentes |
| Funcional | 🟡 | Quebrados: B2 (SSE morto), B3 (usage), B4 (rotas 404), seed loader órfão |
| Segue o plano | 🟡 | Desvios: shadow schemas (ADR-0005), thresholds (tdd-mandatory), seed não wired (SPEC-014) |
| Clean code | 🟢 | ESLint `max-lines:300` enforced, sem god-class, sem TODO/FIXME |
| Clean architecture | 🟢 | 4 camadas isoladas, ports & adapters, DI, EventBus (ADR-0003) |
| SOLID | 🟢 | Strategy de providers, use-cases single-resp |
| DRY | 🔴 | Shadow schemas, handler duplicado, 4 fontes de provider |
| YAGNI | 🟢 | Deferimentos por ADR, sem over-eng |
| Sem bugs | 🔴 | 4 BLOCKER + seed loader + 2 CRITICAL confirmados |
| Sem débito técnico | 🔴 | Threshold leniente, permission store, busca O(n), docs stale |
| Testes sem falhas | 🟢 | `pnpm test` exit 0, typecheck/lint verdes |
| Teste valida o código | 🟡 | Domain/use-cases ouro (98%/94%); worker/E2E/shared-types rasos; B2 prova teste mockado mascarando feature morta |
| Frontend moderno/minimalista | 🟢 | Tokens oklch light/dark, 34 shadcn, zero hardcode |
| Frontend padronizado | 🟢 | Componentes consistentes |
| Frontend reflete funcionalidades | 🔴 | Faltam: pricing, permissions, config voz, seed agents em runtime, dreaming UI |
| Integração BE↔FE correta | 🔴 | Sistêmico: shadow schemas, SSE morto, usage divergente, login schema, logs sem auth |
| Frontend bem distribuído | 🟡 | Nav cobre ~18/28 páginas (usage/design/terminal/enrich só via URL) |
| Melhores práticas UI/UX | 🟡 | a11y axe + aria OK; falta keyboard E2E, filtros, SidebarTrigger mobile |
| Sem ambiguidade | 🔴 | Settings: cards vs tabs (rotas 404) — navegação conflitante |

---

## 9. Veredito final

**Arquitetura madura (domain/use-cases nota-ouro), borda frágil.** Não pronto para release v1.0 sem corrigir:

**Gates obrigatórios antes de release:**
1. **Seed agents em runtime** (wirear loader — gap de paridade REAL, não os "4 vs 70" reportados antes).
2. **B1** SSRF numeric bypass.
3. **B2** SSE `ask_question` (emitir ou remover).
4. **B3** usage unificado via schema.
5. **B4** rotas Settings (criar ou remover tabs).
6. **C2/C4** login schema + logs auth.
7. **O2** ativar Zod nos boundaries (resolve família de contratos).
8. **O4** elevar threshold worker.

**Correção à auditoria anterior:** o "maior gap de paridade (seed agents 4 vs 70+)" está **incorreto** — há 72 YAML migrados. O problema real é **mais sério e mais simples de corrigir**: o loader nunca é chamado. Re-priorizar.
