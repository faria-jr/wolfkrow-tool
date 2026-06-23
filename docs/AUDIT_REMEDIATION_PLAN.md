# Wolfkrow Tool — Plano de Remediação da Auditoria

> Gerado em 2026-06-22 a partir da auditoria profunda Wolfkrow ↔ LionClaw.
> Continua a numeração do `reconciliamento_implementations_plan.md` (Tasks 1–12).
> Numeração: **Task 13 → Task 38**, agrupadas em **6 fases** por prioridade.

---

## Status pós-auditoria (2026-06-23)

Auditoria de evidência (estrutural + funcional via testes) das Tasks 13–29 encontrou **10 REAL · 7 PARCIAL · 0 FALSO**. Os 7 PARCIAL foram corrigidos na branch `feat/audit-fixes` (TDD vermelho→verde). Gates `typecheck`+`lint`+`test` verdes.

| Task | Gap original | Correção | Status |
|---|---|---|---|
| T17 | `tool_permission` SSE type ausente; `PermissionResolver` com `void` (não usado) | `StreamChunk`/`AIStreamChunk`/Zod schema ganham `tool_permission`; `ClaudeAgentProvider` integra resolver de fato (allow/deny/ask + `requestPermission` callback + safe default deny); `writeStreamAsSse` repassa | ✅ base done |
| T18 | `chat.ts` instanciava `new Drizzle*Repo()` em escopo de módulo (viola composition root) | repos expostos via `getRepos()` (chatSession/message/tokenUsage); `chat-store.ts` InMemory morto deletado | ✅ done |
| T19 | Stop abortava stream mas não persistia mensagem parcial; sem teste | `streamAndSave` try/catch no `AbortError` → flush parcial + `done` chunk; teste no-use-case + Stop RTL já existia | ✅ done |
| T22 | 4 routes chamavam `keytar.getPassword` direto (pipeline/voice/enrich/telegram) | helper único `getProviderApiKey`/`getSecret` em `lib/keychain.ts`; `keytar` só em `lib/keychain.ts` | ✅ done |
| T23 | literal `'claude-3-5-sonnet-20241022'` hardcoded (deprecated) no telegram adapter | substituído por `DEFAULT_AGENT_MODEL` (`claude-sonnet-4-6`) | ✅ done |
| T24 | sqlite-vec carregado em boot mas **não usado** pela search | Opção B: load removido do boot (`getSqlite`); JS cosine mantido/testado; `loadVecExtension`/`shouldLoadVec` keep como scaffold testado para futura Opção A (vec0). Consistente com FEATURE_MATRIX §21 | ✅ done |
| T26 | `run-phase` não persistia AI messages nem artifact, sem report | novo `PipelineMessage`+`PipelineMessageRepo` (Drizzle) + `ArtifactWriter`/`FsArtifactWriter`; `run-phase` salva user+assistant + escreve artifact em disco (`artifactPath`); wired no registry+container+route | ✅ done (report final = tech_debt) |

**Pendências remanescentes (tech_debt, não bloqueantes p/ v1.0.0):**
- ~~T17 fluxo UI completo pause/resume~~ → **RESOLVIDO (2026-06-23):** `permission-store` (pending map) + `POST /chat/permission` + chat route detecta agent agentic (`allowedTools` não-vazio) e constrói `ClaudeAgentProvider` com `requestPermission` wired + frontend `ConfirmDialog` aprova/denya via POST.
- ~~T26 report final consolidado~~ → **RESOLVIDO (2026-06-23):** `GeneratePipelineReportUseCase` consolida fases + outputs em Markdown; endpoint `GET /pipeline/projects/:id/report`.
- T24 Opção A (`vec0` virtual table) — **ROADMAP** (decisão: Opção B mantida; A só se RAG > 5k chunks). JS cosine testado e suficiente para o caso local single-user.

---

## 0. Princípios de execução

| Princípio | Regra |
|---|---|
| **TDD obrigatório** | RED → GREEN → REFACTOR. Teste falhando antes da implementação. Backend ≥85%, frontend ≥70% (≥80% em auth/pagamento). |
| **Branch por fase** | `feat/audit-phaseN-*`. Uma worktree por story em fases com paralelismo. |
| **File ownership** | Use-cases na `packages/use-cases`, adapters na `packages/infra`, wiring no `apps/worker/src/container.ts`. Nada de singleton de módulo. |
| **DI sempre** | Novos serviços registrados no `container.ts` / Inversify. Proibido `new XRepo()` em route handler. |
| **Gate de fase** | Cada fase só fecha com `pnpm typecheck && pnpm lint && pnpm test` verdes. |
| **Docs junto do código** | ADR novo para cada decisão arquitetural; FEATURE_MATRIX reclassificada ao fim de cada fase. |

### Mapa Fase → Achados da auditoria

| Fase | Foco | Achados cobertos |
|---|---|---|
| **0** | Estabilização imediata | BUG-1 |
| **1 (P0)** | Núcleo agêntico + persistência | NM-1, NI-1, NI-2, FP-1, FP-2, NI-9, BUG-2/4 |
| **2 (P1)** | Itens "✅ falsos" + dívida | NI-6, NI-8, FP-3, FP-7, BUG-3/6, opt 4/5/6 |
| **3 (P2)** | Escala + integrações | NI-3, NI-4, NI-5, NI-7, NM-3, FP-4, BUG-5 |
| **4** | Reconciliação documental | FP-5, FP-6, FP-8, NM-2, NM-4, SC-1..3 |
| **5 (P3)** | Backlog de features ⛔ | NI-10 (excalidraw, artifacts, pricing, spec-seed, benchmark, audit-UI) |

---

## FASE 0 — Estabilização (bloqueante, ~0,5 dia)

### Task 13 — Corrigir `pnpm typecheck` vermelho `[BUG-1]` 🔴
**Domínio:** frontend · **Dep:** nenhuma · **Esforço:** XS

- **Arquivos:**
  - `apps/web/components/enrich/__tests__/enrich-view.test.tsx:2` — `userEvent` importado e não usado (TS6133).
  - `apps/web/components/pipeline/__tests__/pipeline-template-picker.test.tsx:19` — `HTMLElement | undefined` passado onde se espera `Element` (TS2345).
- **Passos:**
  1. RED: rodar `pnpm --filter @wolfkrow/web typecheck` → reproduzir os 2 erros.
  2. GREEN: remover import morto; guardar o elemento com `if (!el) throw` ou usar `getByRole`/`!` após asserção (`expect(el).toBeDefined()`).
  3. REFACTOR: varrer outros `screen.getByX()[i]` sem narrowing.
- **Critérios de aceitação:**
  - [ ] `pnpm typecheck` verde nos 18 pacotes.
  - [ ] `pnpm lint` verde.
  - [ ] CI volta a passar.

---

## FASE 1 — Núcleo agêntico + persistência (P0, ~10–14 dias)

> Restaura a proposta de valor nº1 do PRD: agente com acesso a terminal/filesystem e histórico real. **Maior fatia do esforço total.**

### Task 14 — Domínio: `Tool` port + value-objects `[NM-1]` 🔴
**Domínio:** domain · **Dep:** Task 13 · **Esforço:** S

- **Arquivos novos:**
  - `packages/domain/src/services/tool-port.ts` — interface `ToolExecutor { name; description; inputSchema; execute(input, ctx): Promise<ToolResult> }`.
  - `packages/domain/src/value-objects/tool-call.ts`, `tool-result.ts`.
  - `packages/domain/src/services/permission-resolver.ts` — já existe; estender para `canUseTool(agent, toolName, input)` com `allow|deny|ask`.
- **TDD:** testes puros de `PermissionResolver` (safe tools → allow; destrutivo → ask; desconhecido → deny). Sem mocks de infra.
- **Critérios:** [ ] contratos exportados em `domain/index.ts`; [ ] permission-resolver com 100% das branches testadas.

### Task 15 — Infra: implementação das tools (bash, fs, web) `[NM-1]` 🔴
**Domínio:** infra · **Dep:** Task 14 · **Esforço:** L

- **Porta do LionClaw** `electron/main/lion-sdk/tools/*` → `packages/infra/src/tools/`:
  - `bash-tool.ts` (child_process com timeout + sandbox de cwd), `filesystem-tool.ts` (read/write/edit/glob/grep, paths restritos a allowlist), `web-tool.ts` (fetch/search), `todo-tool.ts`, `ask-user-tool.ts`, `memory-tool.ts`, `skill-tool.ts`.
  - `tool-registry.ts` — resolve `allowedTools[]` do agente → `ToolExecutor[]`.
- **Segurança (BLOCKER de QA):**
  - bash: timeout configurável, sem `sudo`, cwd preso em workspace; comandos destrutivos (`rm`, `git push`) → `PermissionResult.ask`.
  - filesystem: rejeitar path traversal (`..`), sandbox em diretório do projeto/`.wolfkrow/`.
- **TDD:** cada tool com teste unitário (mock de `child_process`/`fs` — ver `mock-only-repository-tests`); path traversal e timeout cobertos.
- **Critérios:** [ ] registry mapeia nomes→executors; [ ] tools perigosas retornam `ask`; [ ] ≥85% cobertura.

### Task 16 — `ClaudeAgentProvider` com loop de tools real `[NI-1, FP-1]` 🔴
**Domínio:** infra · **Dep:** Task 15 · **Esforço:** L

- **Arquivo:** `packages/infra/src/ai-providers/claude-agent.ts` (reescrever `query()`).
- **Implementação:**
  1. Emitir as `ToolDefinition[]` no request (já há o parâmetro — passar de verdade).
  2. No stream, capturar blocos `tool_use` → emitir `StreamChunk { type: 'tool_call', name, input }`.
  3. Executar via `ToolExecutor` (respeitando `PermissionResolver` → se `ask`, pausar e emitir `tool_permission_request`).
  4. Reinjetar `tool_result` e continuar o loop até `stop_reason = end_turn` (max turns do agente, default 80).
  5. Atualizar `factory.ts` para injetar `toolRegistry.forAgent(agent)` ao criar `ClaudeAgentProvider`.
- **TDD:** mock do SDK Anthropic devolvendo `tool_use` → asserta execução + reinjeção + parada em `end_turn`; teste de `max_turns`.
- **Critérios:** [ ] loop tool_result funcional; [ ] respeita permission `ask`; [ ] comentário do arquivo reflete o comportamento real.

### Task 17 — `StreamChunk` + SSE com eventos de tool `[NI-1, opt 6]` 🔴
**Domínio:** infra + worker + frontend · **Dep:** Task 16 · **Esforço:** M

- **Arquivos:**
  - `packages/infra/src/ai-providers/types.ts` — estender `StreamChunk` com `type: 'text'|'tool_call'|'tool_result'|'tool_permission'|'done'`.
  - `apps/worker/src/routes/chat.ts` — `writeStreamAsSse` repassa novos tipos.
  - `apps/web/components/chat/` — renderizar tool calls colapsáveis (input/output) + diálogo de permissão (reusar `ConfirmDialog`).
  - `packages/shared-types/src/events/sse-events.ts` — novos schemas Zod.
- **TDD:** worker (SSE emite tool events); frontend (RTL: tool call colapsável, botão de permissão dispara POST).
- **Critérios:** [ ] tool calls aparecem inline; [ ] aprovar/negar permissão no UI controla execução.

### Task 18 — Persistência de chat no Drizzle `[NI-2, FP-2, BUG-2, BUG-4]` 🔴
**Domínio:** infra + worker · **Dep:** Task 13 · **Esforço:** M (paraleliza com 14–17)

- **Arquivos novos:**
  - `packages/infra/src/repos/chat-session-repo.ts`, `message-repo.ts` (Drizzle, usando `db/schema/chat.ts` que já existe).
  - `packages/infra/src/repos/registry.ts` + `apps/worker/src/container.ts` — registrar e expor `repos.chatSession` / `repos.message`.
- **Mudança:** `apps/worker/src/routes/chat.ts` — **remover** `new InMemoryChatSessionRepo()/MessageRepo()` de escopo de módulo; obter via `getRepos()`.
- **Migração:** confirmar que `scripts/migrate-lionclaw.ts` popula a mesma tabela; ajustar MIGRATION doc só depois de validar end-to-end.
- **TDD:** repos com `AsyncMock`/`MagicMock` (regra mock-only); teste de integração leve "envia 2 mensagens → reabre sessão → histórico presente".
- **Critérios:** [ ] histórico sobrevive a restart; [ ] sessão isolada por `userId`; [ ] `InMemory*Repo` movido para `test-utils`; [ ] tabela `chat` deixa de ser órfã.

### Task 19 — Wiring "Stop" + verificação de interrupção `[NI-9]` 🟡
**Domínio:** frontend · **Dep:** Task 17 · **Esforço:** S

- **Arquivos:** `apps/web/components/chat/chat-view.tsx` + store Zustand de streaming.
- **Implementação:** botão Stop aborta o `EventSource`/fetch; backend já tem `AbortController` ([chat.ts:102-103]). Garantir flush da mensagem parcial no DB (Task 18).
- **TDD:** RTL — clicar Stop fecha o stream e persiste parcial.
- **Critérios:** [ ] Stop interrompe < 200ms; [ ] mensagem parcial salva.

**Gate Fase 1:** chat real com tools + histórico persistente; reclassificar NI-1/NI-2 na FEATURE_MATRIX de ✅-falso para ✅-real.

---

## FASE 2 — Itens "✅ falsos" + dívida técnica (P1, ~6–8 dias)

### Task 20 — Gravar `token_usage` em todo turn `[NI-6, BUG-3]` 🟠
**Domínio:** use-cases + infra · **Dep:** Task 18 · **Esforço:** S

- **Arquivos:**
  - `packages/use-cases/src/chat/send-message.ts:81-82` — **remover** `void inputTokens; void outputTokens;`; persistir via `TokenUsageRepo`.
  - `packages/infra/src/repos/token-usage-repo.ts` — método `record({ userId, model, source: 'chat'|'harness'|'scheduled', inputTokens, outputTokens, cost })`.
  - Injetar nos use-cases de chat / harness / scheduler.
- **Cost:** usar `PricingCalculator` (já existe em domain).
- **TDD:** teste assert que turn grava 1 linha com tokens/custo corretos; harness e scheduled também.
- **Critérios:** [ ] Usage page exibe dados reais; [ ] budget banner reage a custo acumulado.

### Task 21 — Attachments no chat `[NI-8]` 🟡
**Domínio:** frontend + worker · **Dep:** Task 17 · **Esforço:** M

- **Arquivos:**
  - `apps/web/app/api/chat/upload/route.ts` (novo) ou multipart no `/send`.
  - `apps/web/components/chat/` — dropzone de imagem/PDF/code.
  - `apps/worker/src/routes/chat.ts` — aceitar `attachments[]`; converter imagens em blocos `image` do Anthropic; PDF/code → texto via `doc-parsers` (já existem em `knowledge/parsers`).
  - `packages/infra/src/db/schema/chat.ts` — usar `chat_attachments` (verificar se existe; criar migration se faltar).
- **TDD:** worker (anexo de imagem vira bloco image); frontend (dropzone aceita tipos válidos, rejeita > limite).
- **Critérios:** [ ] enviar imagem/PDF/code; [ ] validação de tamanho/tipo; [ ] persistência do anexo.

### Task 22 — Harness via DI + helper único de API key `[FP-3, BUG-6]` 🟡
**Domínio:** worker + use-cases · **Dep:** Task 16 · **Esforço:** S

- **Arquivos:**
  - `apps/worker/src/lib/keychain.ts` (novo) — `getProviderApiKey(provider)` único; substituir as cópias em `harness.ts:34`, `orchestrator.ts:129`, `agent-executor.ts:57`.
  - Mover `createLlmPlanner/Coder/Evaluator` de `routes/harness.ts` para adapters injetados no `container.ts`.
- **TDD:** teste do helper (falta de key → erro claro); harness usa agentes do container (mock).
- **Critérios:** [ ] zero `keytar.getPassword` duplicado em handlers; [ ] agentes resolvidos por DI.

### Task 23 — Constante de modelo default unificada `[FP-7]` 🟢
**Domínio:** shared-types · **Dep:** nenhuma · **Esforço:** XS

- **Arquivos:** criar `packages/shared-types/src/constants/models.ts` com `DEFAULT_CHAT_MODEL`, `DEFAULT_CODER_MODEL`; substituir literais `claude-3-5-sonnet-20241022` em `chat.ts:24` e `agent-executor.ts:29`.
- **Critérios:** [ ] um único ponto de verdade para defaults; [ ] alinhado ao modelo usado no harness.

**Gate Fase 2:** Usage com dados; chat com anexos; harness limpo. Reclassificar NI-6/NI-8.

---

## FASE 3 — Escala + integrações (P2, ~12–16 dias)

### Task 24 — Vector search com `vec0` (ou decisão documentada) `[FP-4, BUG-5]` 🟠
**Domínio:** infra/database · **Dep:** nenhuma · **Esforço:** M

- **Problema atual:** cosine brute-force em JS ([knowledge-chunk-repo.ts:33-42]); `sqlite-vec` carregado mas não usado.
- **Opção A (recomendada):** criar virtual table `vec0` com dimensão correta (voyage-3 = 1024) e migration; reescrever `search()` para `vec_distance_cosine`. Migration up/down testada (regra database).
- **Opção B:** manter JS mas documentar limite (ex.: ≤ 5k chunks) e remover load de `sqlite-vec` do boot para não falhar.
- **TDD:** integração — ingerir N docs, query retorna top-k por similaridade; benchmark de latência.
- **Critérios:** [ ] search escala O(log n) (Opção A) **ou** limite documentado (B); [ ] sqlite-vec usado de fato ou removido.

### Task 25 — Harness: Coder com tools + loop automático `[NI-4, opt 11]` 🟠
**Domínio:** worker + use-cases · **Dep:** Task 16, Task 22 · **Esforço:** L

- **Implementação:**
  - `createLlmCoder` usa `ClaudeAgentProvider` **com tools** (Task 16) → escreve arquivos/roda bash de verdade, não texto.
  - Orquestrar loop Planner→Coder→Evaluator→retry no worker (`apps/worker/src/harness/runner.ts` novo), respeitando `maxRoundsPerFeature`. Streaming de progresso via SSE.
  - Isolamento: rodar Coder em diretório de trabalho sandbox por projeto.
- **TDD:** runner com agentes mock — passa em N rounds; falha → feedback → retry; respeita max rounds.
- **Critérios:** [ ] Coder produz mudanças reais em arquivos; [ ] loop automático; [ ] métricas por round persistidas.

### Task 26 — Pipeline: execução de fases com IA `[NI-5]` 🟠
**Domínio:** worker + use-cases · **Dep:** Task 16 · **Esforço:** L

- **Arquivos:** `apps/worker/src/routes/pipeline.ts` (handler `run`) + `packages/use-cases/src/pipeline/run-phase.ts` (novo).
- **Implementação:** cada stage chama IA — discovery (entrevista), spec-build (PRD+SPEC), spec-validate (review). Persistir `pipeline_messages`/`pipeline_artifacts`. Stage final `implementation` → chama Harness runner (Task 25).
- **Pipeline report (#37):** gerar relatório final consolidado.
- **TDD:** run-phase com IA mock gera artifact; approve→next stage.
- **Critérios:** [ ] fases geram artefatos reais; [ ] report final; [ ] aprovação humana entre stages.

### Task 27 — Port dos MCP servers prioritários `[NI-3]` 🟡
**Domínio:** infra (mcp-servers) · **Dep:** nenhuma · **Esforço:** L

- **Portar do LionClaw** `mcp-servers/` → `packages/mcp-servers/` (prioridade): `google-calendar`, `google-gmail`, `youtube`, depois `google-drive`/`sheets`, `elevenlabs`, `excalidraw`.
- Mover cada um de `PLANNED_MCP_SERVERS` para `BUILT_IN_MCP_SERVERS` ([built-in-mcps.ts]) ao ficar pronto, apontando para `dist/index.js` real.
- **TDD:** smoke test JSON-RPC por servidor (handshake + 1 tool call mock).
- **Critérios:** [ ] ≥ 3 MCPs externos reais adicionais; [ ] catalog reflete real vs planned com honestidade.

### Task 28 — STT Whisper local `[NI-7]` 🟡
**Domínio:** worker · **Dep:** nenhuma · **Esforço:** M

- **Arquivos:** `apps/worker/src/voice/whisper.ts` — adicionar caminho `whisper.cpp` subprocess (vendor binary) selecionável por config; manter OpenAI API como fallback.
- **TDD:** mock subprocess → transcrição; fallback quando binário ausente.
- **Critérios:** [ ] STT local funcional; [ ] seleção local|api por setting.

### Task 29 — Compaction engine de conversa `[NM-3]` 🟡
**Domínio:** use-cases + worker · **Dep:** Task 18 · **Esforço:** M

- **Portar** `lion-sdk/compaction/` → `packages/use-cases/src/chat/compact-session.ts` (já existe stub) com trigger por token threshold; salvar summary; reduzir histórico injetado.
- **TDD:** ao exceder threshold, sumariza e reduz contexto; idempotente.
- **Critérios:** [ ] compaction automática + manual; [ ] log de compaction (audit trail).

**Gate Fase 3:** RAG escalável; harness/pipeline executam IA real; +3 MCPs; voz local.

---

## FASE 4 — Reconciliação documental (~2 dias)

### Task 30 — ADR: Voyage embeddings + JS/vec0 `[FP-5]`
- Novo `docs/adr/0028-voyage-embeddings.md` (supera ADR-0016 na parte de embeddings). Corrigir ADR-0016:92 ("Anthropic embeddings") e PRD §2.1.5 ("Embeddings via Anthropic API" → Voyage).

### Task 31 — Corrigir ARCHITECTURE.md `[FP-6]`
- Worker = **Fastify** (não `http.createServer` cru). Remover "14 executors" → listar os 7 providers reais. Embeddings = Voyage. Vector search = estado real pós-Task 24.

### Task 32 — Reclassificar FEATURE_MATRIX `[FP-8]`
- "3 MCPs internos ✅" → só `wolfkrow-skills` real; `wolfkrow-agents`/`user-question` = PLANNED. "FTS5+vector" → keyword LIKE + (vec0 ou JS). Atualizar status de NI-1..6 conforme fases concluídas.

### Task 33 — MIGRATION + decisões de escopo `[BUG-2, NM-2, NM-4, SC-1..3]`
- MIGRATION.md: validar claim de histórico só após Task 18. Documentar consolidação de executors (zai/google/minimax → OpenRouter) e adições fora do LionClaw (OpenRouter, Storybook, design-tokens) como decisões intencionais.

---

## FASE 5 — Backlog de features ⛔ (P3, sob demanda) `[NI-10]`

| Task | Feature | SPEC | Esforço |
|---|---|---|---|
| 34 | Excalidraw inline no chat (#34) | SPEC-002 | M |
| 35 | Artifact detection em tool results (#36) | SPEC-002 | M |
| 36 | Pricing calculator multi-fonte (#40) | SPEC-018 | S |
| 37 | Spec build/validate/enrich seed agents (#20) | SPEC-016 | M |
| 38 | Knowledge benchmark suite (#22) + Audit log UI (#38) | SPEC-004/020 | M |

> Reavaliar necessidade real antes de implementar — alguns foram removidos intencionalmente (benchmark = FIX-031).

---

## Grafo de dependências (caminho crítico)

```
Task 13 ─┬─► Task 14 ─► Task 15 ─► Task 16 ─► Task 17 ─► Task 19
         │                          │   │
         │                          │   └─► Task 25 (harness real)
         │                          └─────► Task 26 (pipeline IA)
         └─► Task 18 ─► Task 20 ─► (Usage)
                    └─► Task 21 (attachments)
                    └─► Task 29 (compaction)

Paralelos sem dep do núcleo: Task 23, 24, 27, 28, 30–33
```

## Estimativa consolidada

| Fase | Tasks | Esforço | Prioridade |
|---|---|---|---|
| 0 | 13 | 0,5 d | 🔴 imediato |
| 1 | 14–19 | 10–14 d | 🔴 P0 |
| 2 | 20–23 | 6–8 d | 🟠 P1 |
| 3 | 24–29 | 12–16 d | 🟡 P2 |
| 4 | 30–33 | 2 d | 🟡 doc |
| 5 | 34–38 | sob demanda | 🟢 P3 |
| **Total (Fases 0–4)** | **21 tasks** | **~31–40 dias-dev** | |

## Definition of Done (por task)

- [ ] Testes escritos antes (TDD) e passando (≥85% backend / ≥70% frontend).
- [ ] `pnpm typecheck && pnpm lint && pnpm test` verdes.
- [ ] Sem `TODO`/`FIXME`/`void`-de-dado-útil deixados.
- [ ] DI: nenhum `new XRepo()` em handler; tudo via container.
- [ ] ADR criado se decisão arquitetural nova.
- [ ] FEATURE_MATRIX e docs afetadas atualizadas.
- [ ] Segurança: tools perigosas exigem permissão; secrets nunca em log (BLOCKER de QA).
