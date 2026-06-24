# Auditoria Geral Profunda — wolfkrow-tool

**Data:** 2026-06-24
**Escopo:** Paridade LionClaw v1.0 → wolfkrow-tool (refactor Next.js), qualidade de implementação, segurança, débitos, UI/UX, contratos e testes.
**Fontes analisadas:**
- Código-fonte LionClaw: `/Users/juniorfaria/projects/lionclawv1.0` (Electron + React 19, 19 páginas, ~120 componentes, 19 MCP servers, 70+ seed agents, 78 migrations, RAG híbrido, mgraph, dreaming, Open Design Studio).
- Código-fonte wolfkrow-tool: monorepo turborepo/pnpm (apps/{web,worker,wrapper,sidecar} + 8 packages), 38 tabelas Drizzle, ~192 arquivos de teste.
- Docs wolfkrow: 22 specs, 32 ADRs, PRD, ARCHITECTURE, FEATURE_MATRIX, IMPLEMENTATION_PLAN, MIGRATION, + 4 auditorias prévias (AUDIT_REPORT, review-audit, funcionalidades-residuais, reconciliamento).

**Metodologia:** 4 subagentes paralelos validaram claims **direto no código (file:line)**, com atitude cética — falsos positivos de auditorias prévias foram refutados e bugs reais confirmados.

---

## 1. Sumário Executivo

### Veredito geral: **NÃO pronto para release v1.0. Arquitetura madura, camada de borda frágil.**

O wolfkrow-tool **não é vaporware**: as 22 specs têm código real, arquitetura limpa em camadas (domain → use-cases → infra) sólida e bem testada (98%/94% de cobertura), lint/typecheck 100% verdes e zero god-classes. Agentes de inventário superficial concluem "pronto" — incorreto. A auditoria profunda revela **1 BLOCKER de segurança residual, 4 BLOCKERS funcionais e ~20 MAJOR/CRITICAL** concentrados na **camada de borda** (contratos backend↔frontend, frontend incompleto, thresholds de teste lenientes).

| Dimensão | Veredito |
|---|---|
| Arquitetura (clean arch, SOLID, DDD) | 🟢 **Excelente** — 4 camadas isoladas, ports & adapters, DI, EventBus |
| Domain + use-cases | 🟢 **Sólido** — cobertura 98%/94%, testes de qualidade |
| Segurança (core) | 🟢 **Forte** — ES256+keytar, CSP, SQLi parametrizado, sem secrets |
| Segurança (residual) | 🔴 **1 SSRF bypass** (decimal/octal/hex) explorável |
| Contratos backend↔frontend | 🔴 **Sistêmico** — 20 schemas Zod são "shadow", evento SSE morto, usage divergente |
| Frontend UI/UX | 🟡 **Bom base, lacunas** — design system OK, mas rotas mortas, placeholders, features faltando |
| Testes (quantidade) | 🟢 875+ testes, verdes |
| Testes (qualidade/governance) | 🟡 **Rasos onde importa** — thresholds lenientes mascaram worker em 55% (regra exige 85%) |
| Paridade LionClaw | 🟡 **~90%** — 5 lacunas UI + GAP crítico de seed agents (4 vs 70+) |

### Contagem por severidade (achados únicos confirmados no código)

| Severidade | Qtde | Itens |
|---|---|---|
| 🔴 BLOCKER | 5 | Rotas Settings 404, SSE ask_question morto, usage 3-shapes, coverage worker 55%, SSRF numeric bypass |
| 🟠 CRITICAL | 4 | Schemas Zod shadow, LoginResponse desatualizado, knowledge/search duplicado, /logs sem auth |
| 🟡 MAJOR | 11 | Bug abort #4, Bug permission #3, RM1 registry, RM3 tools, audit sem filtros, Excalidraw externo, pricing ausente, SidebarTrigger, permissions placeholder, pipeline-report `<pre>`, SSE parse sem try/catch |
| 🔵 LOW | 6+ | testes rasos, E2E frágeis, act() warnings, FEATURE_MATRIX desatualizado, memory tag stale, CRIT-1 residual allowlist |

---

## 2. Paridade LionClaw → Wolfkrow (responde: "funcionalidade não mapeada?")

Cobertura geral **~90%**. As lacunas reais:

### 2.1 Funcionalidades LionClaw SEM correspondência adequada no wolfkrow

| Feature LionClaw | Status wolfkrow | Severidade |
|---|---|---|
| **70+ seed agents** (14 pipeline + 13 segurança + dev/db/arch/devops + outros) | Apenas **~4-6** seed agents implementados. SPEC-014 promete migrar 67 | 🔴 **CRÍTICO** — maior gap de paridade |
| **HyDE + Cohere Reranking + RRF + BM25** (RAG híbrido rico) | Busca keyword LIKE + cosine JS O(n). Sem rerank, sem HyDE, sem BM25/FTS5 | 🟠 MAJOR — ADR-0028 escolheu simplificar |
| **mgraph (vault Obsidian/ROAM-like)** com entities/meetings/decisions/projects | Graph view D3 (extração de entidades) — equivalente visual, **menos rico** como base de conhecimento estruturada | 🟡 |
| **Config de Voz no Settings** (seletor STT/TTS/provider) | **AUSENTE** — `settings-view.tsx` é só hub de links | 🟠 MAJOR |
| **Dreaming UI** (visualização de limpeza/consolidação MEMORY.md) | Backend existe (`memory/dreaming/`), **sem UI frontend** | 🟡 |
| **Permissions management UI** (catálogo allow/deny/ask por agent) | `permissions/page.tsx` = **15 linhas, placeholder puro** | 🟠 MAJOR |
| **Pipeline de 14 fases** (Discovery→PRD→Tech DB/BE/FE/Sec→Spec→Enrich→Planner→Sprint→Coder→Evaluator) | Pipeline engine existe, mas é **mais simples/interativo** (state machine). Harness/loop auto deferido v1.1 | 🟡 — decisão de escopo |
| **Open Design Studio** (vendor/open-design 106MB, fases, snapshots, locks, auto-correct) | Sidecar Next.js + iframe — funcional mas **mais enxuto** | 🟡 |
| **Cohere rerank provider** | Não mapeado (busca simplificada) | 🔵 |
| **CodeBurn** (terminal avançado com resolução de node binário por OS) | PTY xterm via WebSocket — funcional | 🟢 OK |

### 2.2 Itens explicitamente fora de escopo (intencionais, documentados em ADR)

| Item | Decisão | ADR | Justificativa |
|---|---|---|---|
| Higgsfield (image/video gen) + Blotato (social posting) MCPs | **Deferido v2** | ADR-0031 | OAuth browser conflita com worker Node-only; nano-banana já cobre imagem |
| Knowledge Benchmark (recall@k, MRR, NDCG) | **Removido v1.0** | ADR-0032 | Ferramenta dev/CI sem dataset ground-truth; custo sem ROI |
| Harness loop AI automático (Planner→Coder→Evaluator) | Deferido v1.1 | SPEC-005 | UI existe; loop auto = esforço L |
| Memory search UI, Pricing calculator, Audit filters, Excalidraw inline, Artifact detection | Parcialmente deferidos | FEATURE_MATRIX | (ver §4 — alguns JÁ implementados, FEATURE_MATRIX desatualizado) |
| Multi-tenant, cloud-hosted, mobile-first, collab real-time, voice cloning, fine-tuning | Não-objetos v1.0 | PRD | Decisão de produto |

**Conclusão paridade:** O núcleo funcional (chat, voz, knowledge, agents, skills, vault, MCP, scheduler, telegram, pty, electron, memory, graph) **está mapeado e implementado**. O maior gap real é **seed agents (4 vs 70+)** — é a única funcionalidade com déficit de paridade grande o suficiente para comprometer a promessa de "paridade 100%". O resto são simplificações documentadas.

---

## 3. Item mapeado que NÃO foi implementado (ou implementado de forma não-funcional)

| Item (SPEC/Matrix) | Estado declarado | Realidade no código |
|---|---|---|
| SPEC-014 — 67 seed agents YAML | "migrar 67 .ts → YAML" | ❌ Só ~4-6 agentes seed |
| SPEC-018 — Pricing calculator | FEATURE_MATRIX ⛔ v1.1 | ❌ Confirma: **nenhuma UI** de pricing |
| Permissions management (SPEC-020) | "CRUD backend+UI" | ⚠️ UI é placeholder de 15 linhas |
| Memory search UI (SPEC-015) | FEATURE_MATRIX ⛔ v1.1 | ✅ **JÁ existe** (`memory-body.tsx:87`) — MATRIX desatualizada |
| Artifact detection (SPEC-002) | FEATURE_MATRIX ⛔ | ✅ **JÁ existe** (`artifact-detector.ts`) — MATRIX desatualizada |
| Pipeline report (SPEC-006) | status confuso | ⚠️ Existe mas renderiza markdown como `<pre>` (perde formatação) |
| Excalidraw inline (SPEC-002) | ⛔ | ⚠️ É **link externo**, não inline (`artifact-card.tsx:71`) |
| Config de voz (Settings) | implícito | ❌ Ausente |

---

## 4. Implementado FORA dos padrões do projeto

### 4.1 Violação de governance — thresholds de cobertura lenientes (regra `tdd-mandatory`)
A regra global exige backend ≥85%, frontend ≥70%. Os vitest.config do projeto baixam artificialmente:

| Package | Threshold cfg | Cobertura real | Regra exige | Status |
|---|---|---|---|---|
| `apps/worker` | **25%** | **55%** | 85% | 🔴 BLOCKER (CI passa verde falso) |
| `apps/web` | **20%** | 81% | 70% | 🟢 real OK, cfg leniente |
| `packages/shared-types` | **25%** | 29% lines / **0% branch** | — | 🔴 contratos sem teste de branch |
| `packages/domain` | 95% | 98% | 95% | 🟢 |
| `packages/use-cases` | 90% | 94% | 90% | 🟢 |

### 4.2 Violação DRY — "shadow schemas" (CRÍTICO)
`packages/shared-types/src/schemas/` tem 20 schemas Zod, mas **NENHUM é importado para validação** no worker ou web. O worker reescreve schemas inline (`vault.ts:70`, `knowledge.ts:28`, `usage.ts:13`) e o chat valida o body com interface TS pura, **sem validação** (`chat.ts:23-31`). Zod deveria ser single source of truth (ADR-0005) — não é.

### 4.3 Violação DRY — duplicação de handlers e fontes
- `knowledge/search` existe como route handler web **E** route worker — o do worker é **morto**.
- **4 fontes de providers divergentes** (RM1): `provider-registry.ts:33`, `claude-compat-presets.ts:32`, `pricing-calculator.ts:64`, `pricing-calculator.ts:92` + inferência por prefixo em `orchestrator.ts:52`.

### 4.4 E2E com código morto / assertions falsas (viola "teste valida o código")
- `chat.spec.ts:8` — `test.skip(... => false)` nunca skipa (morto).
- `chat.spec.ts:19` — diz "cria sessão nova" mas só checa `toHaveURL(/chat/)`.
- `tasks.spec.ts` — não submete o form, não valida criação.

---

## 5. Bugs e Débitos Técnicos (todos confirmados com file:line)

### 🔴 BLOCKERS

**B1 — Rotas mortas no Settings (UX quebrada)**
`components/settings/settings-shell.tsx:9-17` referencia 9 tabs `/settings/*`, mas só `/settings` e `/settings/providers` existem. As outras 8 (`/vault`, `/agents`, `/mcp`, `/automation`, `/rules`, `/permissions`, `/channels`, `/usage`) → **404**. Há também navegação duplicada conflitante (`settings-view.tsx` cards vs `settings-shell.tsx` tabs).
*Fix:* criar as 8 rotas faltantes OU remover as tabs mortas; consolidar nav.

**B2 — Evento SSE `ask_question` morto (funcionalidade quebrada)**
Frontend declara handler (`sse.ts:10`, `chat-hooks.ts:28,196`) mas `grep "ask_question" apps/worker/src` = vazio. Worker **nunca emite** → `pendingQuestion` nunca dispara. A funcionalidade "agente pergunta ao usuário durante streaming" está morta.
*Fix:* worker emitir `ask_question` no loop agêntico OU remover o handler morto do frontend.

**B3 — Response de usage com 3 shapes incompatíveis**
- Frontend espera: `totalInputTokens`/`totalOutputTokens`/`totalCostUSD`/`byDay` (Record) — `usage-charts.tsx:26`
- Schema compartilhado: `totalTokens`/`totalCost`/`byDay` (array) — `usage.ts:30`
- Worker retorna `summary` **sem tipo nem validação** — `worker usage.ts:46`
*Fix:* unificar no schema compartilhado e importar nos 3 lados.

**B4 — Coverage worker 55% abaixo da regra (85%)**
Threshold cfg = 25% mascara. Worker é camada HTTP crítica (32 routes, auth, MCP, chat, vault). Metade sem teste. Ver §4.1.
*Fix:* elegar threshold para 85% progressivamente + cobrir routes críticas.

**B5 — SSRF bypass decimal/octal/hex (segurança)**
`packages/domain/src/value-objects/provider-config.ts:12-15,57-61` valida URL por prefixo string. IPv4/IPv6/mapped/`[::1]` cobertos, MAS:
- `http://2130706433/` (decimal = 127.0.0.1) **passa**
- `http://0177.0.0.1/` (octal) **passa**
- `http://0x7f000001/` (hex) **passa**
Permite acesso a metadata services internos (ex: `169.254.169.254` AWS via decimal) dependendo do provider.
*Fix:* resolver hostname via `node:dns`, validar IP resolvido; ou normalizar representações numéricas antes do match.

### 🟠 CRITICAL

**C1 — Schemas Zod shadow (trust cego do body)**
Ver §4.2. `chat.ts:23-31` aceita qualquer shape no body do chat. Risco de erro 500/inconsistência silenciosa. *Fix:* importar e aplicar `parse()` dos shared schemas em todo boundary.

**C2 — LoginResponseSchema desatualizado**
Schema declara `requires_totp` + `challengeId`; handler retorna `userId` (`login/route.ts:72`). Contrato quebrado na autenticação. *Fix:* alinhar schema ↔ handler.

**C3 — Handler knowledge/search duplicado**
Route web (executa use-case) + route worker (morto). Manutenção futura diverge. *Fix:* remover o morto.

**C4 — Rota `/logs/stream` sem autenticação**
`worker/src/routes/logs.ts` sem `onRequest: [app.authenticate]` (vs knowledge/vault que exigem). Proxy web (`app/api/logs/stream/route.ts:14`) não repassa cookie. Inconsistência de segurança — logs podem vazar.
*Fix:* adicionar `app.authenticate`.

### 🟡 MAJOR (bugs funcionais)

| ID | Bug | Localização | Fix |
|---|---|---|---|
| M1 | **Bug #4** — abort/Stop não propaga pra tool em execução (stream agêntico cancela HTTP mas tool continua rodando até fim) | `claude-compat.ts:107,153` | passar `signal` pra `executeTool`, checar `signal.aborted` antes de `executor.execute()` |
| M2 | **Bug #3** — permission store é `Map` in-memory; perde decisões em restart do worker; re-pergunta a mesma tool | `permission-store.ts:20` | persistir decisões aprovadas em DB (tabela existe) |
| M3 | **RM3** — chat **não-agentic** com provider claude-compat (zai/minimax/moonshot) silenciosamente **descarta tools** (`factory.create` sem toolRegistry) | `orchestrator.ts:128-133` vs `chat.ts:88-119` | usar `createFromConfig` quando provider é claude-compat |
| M4 | Audit sem filtros (severity/dimension/file) | `findings-table.tsx:21-48` | adicionar filtros |
| M5 | Excalidraw é link externo, não inline | `artifact-card.tsx:71-99` | embed inline |
| M6 | Pricing calculator ausente | (nenhum arquivo) | implementar (domain `pricing-calculator.ts` existe, falta UI/wiring) |
| M7 | Topbar sem SidebarTrigger → mobile não abre sidebar | `topbar.tsx` | adicionar `<SidebarTrigger/>` |
| M8 | Permissions page = placeholder 15 linhas | `permissions/page.tsx` | implementar CRUD UI |
| M9 | Pipeline report renderiza markdown como `<pre>` | `pipeline-report-view.tsx:62-66` | usar ReactMarkdown |
| M10 | SSE JSON.parse sem try/catch → linha malformada quebra stream | `sse.ts:38`, `chat-stream.ts:52` | wrap try/catch, ignorar linhas inválidas |
| M11 | shared-types com **0% branch coverage** + threshold 25% | `packages/shared-types` | testar schemas (parse válido/inválido) |

### 🔵 LOW / débitos menores

- **CRIT-1 residual:** `ALLOWED_BINARIES` inclui `bash`/`sh`/`zsh` (`bash-tool.ts:18`) → agente pode `bash -c 'rm -rf x'` contornando `FORBIDDEN_PATTERNS` (que só bloqueia sudo/chmod). *Fix:* remover shells do allowlist ou validar argumentos de shells.
- Testes rasos (5 exemplos): `mcp-bridge.test.ts:30,62` (`toBeDefined()` no lugar de conteúdo), `seed-agents.test.ts:65` (schema não validado), `auth.test.ts:155` (`toBeTruthy()`), `providers-a2.test.ts:64,95` (construtor `not.toThrow()`).
- Warnings `act(...)` em 3 componentes (KnowledgeView, AgentsView, SkillsView).
- **Docs desatualizadas:** `FEATURE_MATRIX.md` marca ⛔ 3 features já implementadas; `IMPLEMENTATION_PLAN.md` diz "5% concluído" quando realidade é ~56%; `USER_GUIDE.md` lista features deferred como disponíveis; MEMORY.md diz tag v1.0.0 stale mas **v1.0.1 já existe**.
- Busca vetorial JS cosine O(n) — não escala >5k chunks (roadmap vec0, ADR T24).

---

## 6. Otimizações e Melhorias

| # | Otimização | Impacto |
|---|---|---|
| O1 | **vec0 / sqlite-vec virtual table** para busca vetorial nativa | Performance RAG (escala >5k chunks), elimina cosine JS O(n) |
| O2 | **Consolidar Provider Registry** em fonte única consumida por registry/presets/pricing | Resolve RM1, DRY, previde preço 0/lookup falha |
| O3 | **Importar shared schemas** em todos os boundaries (worker routes + web) | Resolve C1/C3, ativa ADR-0005 de verdade, DRY |
| O4 | **Persistir permission store** em DB + cache in-memory | Resolve M2, UX (não re-pergunta) |
| O5 | **Abort propagation** em tool execution | Resolve M1, economia de trabalho/custo |
| O6 | **Resolver SSRF via DNS** + normalização numérica | Resolve B5 (segurança) |
| O7 | Adicionar **SidebarTrigger mobile**, filtros de audit, Excalidraw inline, pricing UI, permissions CRUD, ReactMarkdown no report | Fecha lacunas frontend (M4-M9) |
| O8 | **Migrar seed agents** LionClaw (70+) → YAML wolfkrow | Fecha maior gap de paridade (SPEC-014) |
| O9 | Elevar thresholds worker→85%, shared-types→testar schemas, remover E2E morto | Governance de testes (§4.1, 4.4) |
| O10 | Adicionar **E2E keyboard navigation** (a11y hoje só cobre axe scan) | Acessibilidade completa |
| O11 | Reconciliar docs (FEATURE_MATRIX, IMPLEMENTATION_PLAN, USER_GUIDE) com realidade | Manutenibilidade |
| O12 | Considerar HyDE + rerank (Cohere ou cross-encoder local) na busca | Qualidade RAG (paridade LionClaw) |

---

## 7. Análise por dimensão (checklist do usuário)

| Critério | Veredito | Evidência |
|---|---|---|
| Item realmente implementado | 🟡 22/22 specs têm código, mas ~6 com déficit (seed agents, pricing, permissions UI, config voz) | §2, §3 |
| Implementado de forma funcional | 🟡 Maioria sim; quebrado: rotas Settings 404 (B1), SSE ask_question morto (B2), usage divergente (B3) | §5 |
| Segue a definição do plano | 🟡 Desvios: schemas shadow (viola ADR-0005), thresholds lenientes (viola tdd-mandatory), seed agents (viola SPEC-014) | §4 |
| Clean code | 🟢 Zero god-classes (ESLint max-lines 300 enforced), AgentFormModal refatorado (1765→83+68), zero TODO/FIXME | Agent E |
| Clean architecture | 🟢 4 camadas isoladas, ports & adapters, DI Inversify, EventBus (ADR-0003) | Agent B/C |
| SOLID | 🟢 Adere (strategy de providers, single-resp use-cases) | Agent B |
| DRY | 🔴 Falha: shadow schemas, 4 fontes de providers, handler duplicado | §4.2, 4.3 |
| YAGNI | 🟢 Bom — deferimentos conscientes (ADRs 0031/0032), sem over-engineering visível | §2.2 |
| Sem bugs | 🔴 5 BLOCKERS + 4 CRITICAL + 11 MAJOR confirmados | §5 |
| Sem débito técnico | 🔴 Débitos: RM1, permission store, abort, busca O(n), docs desatualizadas | §5, §6 |
| Testes unitários sem falhas | 🟢 875+ passam, lint/typecheck verdes | Agent C/E |
| Teste valida o código | 🟡 Domain/use-cases sim (padrão-ouro); worker/E2E/shared-types rasos | §4.4 |
| Segue requisitos do plano | 🟡 Ver "Segue definição do plano" | §4 |
| Segue padrão de qualidade | 🟡 Thresholds lenientes mascaram descumprimento (worker 55% vs 85%) | §4.1 |
| Frontend moderno/minimalista/impactante/usável | 🟡 Design system sólido (tokens oklch, shadcn), mas lacunas UX (rotas mortas, mobile sem trigger) | Agent E |
| Frontend padronizado | 🟢 34 shadcn components consistentes, zero hardcode, design tokens aplicados | Agent E |
| Frontend reflete todas funcionalidades | 🔴 Não — pricing ausente, permissions placeholder, config voz ausente, dreaming sem UI, seed agents escassos | §2.1, §3 |
| Integração backend↔frontend funcional/correta | 🔴 Sistêmico — shadow schemas, SSE morto, usage divergente, login desatualizado, logs sem auth | §5 B2/B3, C1-C4 |
| Frontend bem distribuído/otimizado | 🟡 Nav só cobre 18 de 28 páginas (usage/design/terminal/enrich só via URL) | Agent E |
| Frontend melhores práticas UI/UX | 🟡 Boa base (a11y axe, aria-labels) mas faltam keyboard E2E, filtros, mobile trigger | Agent E |
| Frontend sem ambiguidade | 🔴 Rotas Settings duplicadas (cards vs tabs), navegação conflitante | B1 |

---

## 8. Positivos (equilíbrio)

Para justificar o veredito "arquitetura madura, borda frágil":

- 🟢 **Domain + use-cases de qualidade-ouro**: cobertura 98%/94%, testes com in-memory repos + assertions de conteúdo e ordem temporal (`chat-use-cases.test.ts:150-176`).
- 🟢 **God-classes inexistentes**: ESLint `max-lines:300` enforced; `AgentFormModal` (1765 linhas no LionClaw) refatorado para 83+68; `chat-view` 150 linhas.
- 🟢 **Design system maduro**: tokens oklch com light/dark, mapeados ao `@theme inline` Tailwind v4, 34 shadcn components, zero hardcode hex.
- 🟢 **A11y com axe real** (wcag2a/aa) + aria-labels consistentes.
- 🟢 **Segurança core forte**: JWT ES256 + keytar persistente, secrets mascarados (não trafegam), CSP restritiva, SQLi parametrizado, sem secrets hardcoded. CRIT-1/2 de auditorias prévias **refutados** (corrigidos).
- 🟢 **PWA (Serwist) correto**, manifest + service worker.
- 🟢 **4 features-chave LionClaw todas presentes com UI funcional**: voice orb, design studio, graph (D3 lazy), terminal (xterm+WS).
- 🟢 **Worker é processo real** separado (ADR-0014), não thread.
- 🟢 **lint + typecheck 100% verdes** (30 tasks typecheck, zero erros TS).

---

## 9. Plano de Ação Recomendado (priorizado)

### Antes de release v1.0 (BLOCKER + CRITICAL)
1. **B5** SSRF numeric bypass → resolver DNS/normalizar (`provider-config.ts`).
2. **B2** SSE `ask_question` morto → implementar emissão no worker.
3. **B3** Usage 3-shapes → unificar via shared schema.
4. **B1** Rotas Settings 404 → criar rotas ou remover tabs.
5. **C1** Schemas Zod shadow → importar shared schemas em boundaries.
6. **C2** LoginResponse → alinhar schema/handler.
7. **C4** `/logs/stream` → adicionar auth.
8. **C3** Remover knowledge/search worker morto.

### Qualidade (MAJOR)
9. **M1** abort propagation; **M2** permission store persistente; **M3** tools em claude-compat não-agentic.
10. **M4-M9** lacunas frontend (filtros, Excalidraw, pricing, SidebarTrigger, permissions, report markdown).
11. **B4/M11** elevar threshold worker + testar shared-types.

### Paridade
12. **O8** Migrar seed agents (70+) → fecha SPEC-014 e maior gap.
13. **O7** Config de voz, dreaming UI.

### Governance
14. **O9/O11** Reconciliar docs + thresholds + E2E morto.
15. Re-tag release (v1.0.0 stale ou nova v1.0.1).

---

*Relatório gerado por auditoria de 4 subagentes paralelos com validação cruzada direto no código. Falsos positivos de auditorias prévias (CRIT-1 RCE, CRIT-2 BOLA) foram refutados; bugs reais (SSRF numeric, abort, permission store, shadow schemas) confirmados com evidência file:line.*
