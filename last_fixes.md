# Wolfkrow Tool — Plano de Correções (last_fixes)

> Resultado da auditoria completa de 2026-06-21 (features, tech debt, padrões, clean-arch).
> Cada item = ID rastreável `FIX-NNN` com problema, evidência (`file:line`), passos, critério de aceite, esforço e dependências.
> Origem dos achados: ver auditoria (seções 1–7) e `docs/FEATURE_MATRIX.md` (stale).

## Como usar

- **Prioridade**: `P0` bloqueia uso real · `P1` funcionalidade inerte/wiring · `P2` polish/dívida.
- **Esforço**: `S` ≤ 1 dia · `M` 1–3 dias · `L` > 3 dias.
- **Status**: `[ ]` pendente · `[~]` em andamento · `[x]` concluído.
- Executar na ordem da seção **"Ordem sugerida"** (dependências respeitadas).
- Todo item segue TDD (RED → GREEN → REFACTOR) e os guard-rails de `eslint.config.mjs` (função ≤50 linhas, complexidade ≤10, arquivo ≤300).

---

## P0 — Bloqueadores (impedem uso real)

### [x] FIX-001 — DB path relativo causa DBs split-brain
- **Problema**: `WOLFKROW_DB_PATH` default é relativo ao cwd. Web (`apps/web`), worker (`apps/worker`) e migrate resolvem **arquivos SQLite diferentes** → login cria user num DB, worker lê outro → "invalid credentials", tabelas vazias.
- **Evidência**: `packages/infra/src/db/client.ts:24,32,83` (`DEFAULT_DB_PATH = '.wolfkrow/data/wolfkrow.db'` + `path.resolve(process.cwd(), ...)`).
- **Passos**:
  1. Anchor do path a um root determinístico: `os.homedir()/.wolfkrow/data/wolfkrow.db` (ou `WOLFKROW_DATA_DIR`), nunca cwd.
  2. Garantir que web, worker e migrate resolvem o **mesmo** path sem depender de onde são iniciados.
  3. Mover DBs existentes (`apps/worker/.wolfkrow`, `packages/infra/.wolfkrow`) p/ o novo local (migration one-shot).
  4. Teste: iniciar web+worker de cwds diferentes, criar user no web, autenticar via worker → sucesso.
- **Critério de aceite**: mesmo DB independente do cwd de qualquer processo. Teste E2E verde.
- **Esforço**: M · **Depende de**: —

### [x] FIX-002 — Knowledge search retorna `[]` silenciosamente
- **Problema**: busca vetorial + FTS5 não funcionam — sem tabelas virtuais `vec0`/`fts5` criadas; `catch { return [] }` mascara o erro. RAG aparenta funcionar mas sempre vazio.
- **Evidência**: `packages/infra/src/repos/knowledge-chunk-repo.ts:60-108` (`vec_distance_cosine` em coluna JSON, sem `vec0`; FTS5 nunca criado).
- **Passos**:
  1. Confirmar a estratégia: `sqlite-vec` (`vec0` virtual table) OU embeddings em coluna + distância em app.
  2. Criar a tabela virtual na migration (`packages/infra/drizzle`).
  3. Substituir o `catch { return [] }` por log + propagação (fail-fast).
  4. Testes: ingest → embed → search retorna chunk relevante.
- **Critério de aceite**: ingest de doc fixture → search retorna resultado > 0 com score.
- **Esforço**: M · **Depende de**: FIX-006 (searh via MCP depende) — independente p/ core.

### [ ] FIX-003 — Coverage web 23% (gate ≥70%)
- **Problema**: `@wolfkrow/web` em 23.3% de linhas (gate 70). 11 components `*-view.tsx` a 0%. Sub-gate auth/voice ≥80% violado (hooks `use-vad`/`use-tts`/`use-voice-conversation` 0%).
- **Evidência**: auditoria §5; `apps/web/components/**/*-view.tsx` sem testes.
- **Passos**:
  1. Priorizar fluxos críticos: auth (`login-form`, `onboarding-form` já têm — completar), `vault-view`, `chat-view`, `graph-view`.
  2. Smoke tests RTL p/ cada `*-view.tsx` (render + interação principal).
  3. Testes de hooks de voice (mock Web Audio/MediaRecorder).
  4. Meta: subir p/ ≥70% geral, ≥80% auth/voice.
- **Critério de aceite**: `pnpm --filter @wolfkrow/web test:cov` ≥70% linhas; auth+voice ≥80%.
- **Esforço**: L · **Depende de**: —

### [ ] FIX-003b — Desbloquear coverage infra/worker (binding nativo)
- **Problema**: `better-sqlite3` compilado p/ Node ABI 127; runtime Node 24 exige 137 → `client.test.ts` e `graph.test.ts` crashe; coverage não emite.
- **Evidência**: auditoria §5; `packages/infra/src/db/client.ts:37`.
- **Passos**:
  1. `pnpm rebuild better-sqlite3` (ou `node-gyp rebuild --release` no path `.pnpm`) + commit lock p/ Node 24.
  2. Validar em CI: Docker image Node 24 → rebuild determinístico.
- **Critério de aceite**: `test:cov` de infra + worker emitem coverage; ≥85%.
- **Esforço**: S · **Depende de**: —

### [ ] FIX-033 — Typecheck vermelho (CI-blocking)
- **Problema**: `pnpm typecheck` falha com 4 erros em test files **commitados** (`packages/use-cases/src/__tests__/`). Vitest passa (esbuild não tipa) mas tsc estrito barra.
- **Evidência**:
  - `packages/use-cases/src/knowledge/__tests__/knowledge.test.ts:58` — `'embedding'` declarado, não usado (TS6133).
  - `packages/use-cases/src/pipeline/__tests__/pipeline.test.ts:3` — `'vi'` importado, não usado (TS6133).
  - `packages/use-cases/src/skills/__tests__/skill-use-cases.test.ts:44,48` — `exactOptionalPropertyTypes`: `SkillCreateInput`/`AgentCreateInput` recebem objetos sem `| undefined` (TS2379/2345).
- **Passos**: 1. Remover imports/declarações não usadas. 2. Ajustar fixtures p/ `exactOptionalPropertyTypes` (omitir opcionais em vez de passar `undefined`). 3. `pnpm typecheck` verde.
- **Critério de aceite**: `pnpm typecheck` 0 erros.
- **Esforço**: S · **Depende de**: —

### [ ] FIX-034 — Lint vermelho (CI-blocking) — estabiliza FIX-015
- **Problema**: `pnpm lint` falha com **100 erros** (domain 14, use-cases 17, infra 30, web 24, worker 15). ~80 são `import/order` autofixable. Resto: 1 god-file domain (587 linhas, `max-lines`), 1 `complexity` (parseFrontmatter 12), 1 `max-params` (complete 5). Promove FIX-015 a bloqueador imediato.
- **Evidência**: `pnpm lint`; god-file em `packages/domain/src` (587 linhas); `parseFrontmatter` complexity 12; método `complete` 5 params.
- **Passos**:
  1. `pnpm lint:fix` → zera ~80 import/order.
  2. Split do god-file domain (587 → módulos ≤300).
  3. Reduzir `parseFrontmatter` complexity (extrair helpers) e `complete` params (agrupar em objeto/opts).
  4. Re-rodar até 0 erros.
- **Critério de aceite**: `pnpm lint` 0 erros em todos os packages.
- **Esforço**: M · **Depende de**: —

---

## P1 — Wiring / funcionalidade inerte (parece pronto, não está)

### [ ] FIX-004 — Rules nunca injetadas no LLM
- **Problema**: CRUD + `BuildSystemPromptUseCase` + `/build-prompt` funcionam, mas `agent-executor` e `pipeline` hardcodeiam prompts sem chamar o builder → regras globais inertes.
- **Evidência**: `apps/worker/src/agent-executor.ts:55`, `apps/worker/src/routes/pipeline.ts:112-119`.
- **Passos**: 1. Injetar `BuildSystemPromptUseCase` no executor/pipeline. 2. Compor prompt = base + regras ativas. 3. Teste: regra ativa aparece no prompt enviado ao provider.
- **Critério de aceite**: regra criada no Vault/Rules aparece no system prompt do LLM em runtime.
- **Esforço**: S · **Depende de**: FIX-007 (DI).

### [ ] FIX-005 — Sub-agents runtime não wired ao orchestrator
- **Problema**: CRUD de agentes pronto, mas `orchestrator` tem **0 refs a Agent** → agentes nunca驱动 execução.
- **Evidência**: `apps/worker/src/orchestrator.ts`.
- **Passos**: 1. Definir contrato `AgentRuntime.resolve(agent) → executor`. 2. Orchestrator seleciona executor por `agent.strategy`. 3. Teste: invocar agente → usa strategy/config corretos.
- **Critério de aceite**: agente persistido define comportamento real da execução.
- **Esforço**: M · **Depende de**: FIX-007.

### [ ] FIX-006 — MCP servers inexistentes (G9)
- **Problema**: catalog tem 18 entradas, **0 binários** (`packages/mcp-servers/` não existe) → todo spawn ENOENT → `crashed`. Nenhum MCP roda.
- **Evidência**: `packages/infra/src/seed/built-in-mcps.ts:7-139`; ausência de `packages/mcp-servers/*/dist`.
- **Passos**: 1. Decidir: migrar MCP servers do LionClaw OU gerar stubs buildáveis p/ os internos (knowledge-base, memory-search, graph-search, skills, agents). 2. `packages/mcp-servers/<name>/` com build script. 3. Catalog aponta p/ `dist/index.js` existente. 4. Smoke: `mcpManager.start` p/ 1 server → handshake JSON-RPC ok.
- **Critério de aceite**: ≥3 MCP servers internos sobrem e respondem `tools/list`.
- **Esforço**: L · **Depende de**: —

### [ ] FIX-007 — DI container é stub; 42% das rotas bypass use-cases
- **Problema**: `container.ts` wired só eventBus+logger; rotas fazem `new DrizzleXxxRepo()` inline. Viola §1.1/§1.5.
- **Evidência**: `packages/use-cases/src/container.ts:24-28`; ~39 de 83 rotas importam infra direto.
- **Passos**: 1. Completar container (registrar repos + use-cases). 2. Refatorar rotas web/worker p/ resolver via container (ou factory). 3. Remover `new Drizzle*Repo()` inline + imports diretos de adapters (`KeytarSecretsAdapter`, `VoyageEmbedder`, `BcryptHasher`).
- **Critério de aceite**: nenhuma rota importa `@wolfkrow/infra` diretamente; tudo via container/ports.
- **Esforço**: L · **Depende de**: FIX-027 (ports).

### [ ] FIX-008 — Graph feature misplaced (sem domain/use-case/port)
- **Problema**: lógica de domínio (extração, co-ocorrência, tipos) em `apps/worker/src/knowledge/`, não em `packages/domain`+`use-cases`. `MGraph` é adapter sem port.
- **Evidência**: `apps/worker/src/knowledge/{graph-ingest,mgraph}.ts`; sem `packages/domain/src/repos/graph*`.
- **Passos**: 1. Mover tipos (`GraphNode`/`Edge`/`NodeType`) + extração pura p/ `domain`. 2. Definir port `GraphRepo` em `domain/repos`. 3. `DrizzleGraphRepo` em `infra/repos`. 4. `IngestGraphUseCase`/`QueryNeighborhoodUseCase` em `use-cases/graph`. 5. Rotas resolvem via container.
- **Critério de aceite**: graph segue vertical-slice `domain→use-case→infra→worker→web`; sem lógica em worker/knowledge.
- **Esforço**: M · **Depende de**: FIX-007.

### [ ] FIX-009 — Tasks board misplaced + sem DnD
- **Problema**: `tasks.ts` faz **raw drizzle** (`db.select().from(tasks)`), sem repo/use-case/port. Board move via botões (sem `@dnd-kit`); sem calendar.
- **Evidência**: `apps/worker/src/routes/tasks.ts:8-10,54,78,100`; `apps/web/components/tasks/tasks-board.tsx`.
- **Passos**: 1. Port `TaskRepo` + `DrizzleTaskRepo` + use-cases CRUD/move. 2. Rota via use-case. 3. DnD com `@dnd-kit`. 4. (opcional) view calendar.
- **Critério de aceite**: Tasks via Clean Arch; drag-and-drop funcional.
- **Esforço**: M · **Depende de**: FIX-007.

### [ ] FIX-010 — Wrapper sem dep `electron` + sem auto-update
- **Problema**: `apps/wrapper/main.ts` importa `'electron'` mas `package.json` não declara → não instalável. Falta `electron-updater`.
- **Evidência**: `apps/wrapper/package.json` (R4); sem `autoUpdater` (feature #39).
- **Passos**: 1. Add `electron` + `@types/electron` + `electron-updater` deps. 2. Validar `pnpm --filter @wolfkrow/wrapper build` + `electron dist/main.js`. 3. Wire `autoUpdater` (channels stable/beta).
- **Critério de aceite**: wrapper inicia (BrowserWindow+tray+hotkey); auto-update configurado.
- **Esforço**: M · **Depende de**: —

### [ ] FIX-011 — Voice não wired ao chat
- **Problema**: hooks (`use-vad`, `use-barge-in`, `use-voice-conversation`) + `voice-orb` reais mas **não renderizados** no chat.
- **Evidência**: `apps/web/components/voice/voice-orb.tsx`; chat-view sem import.
- **Passos**: 1. Integrar orb + hooks no `chat-view`. 2. STT→input→send, TTS→resposta. 3. Barge-in cancela TTS.
- **Critério de aceite**: conversa por voz end-to-end no chat.
- **Esforço**: M · **Depende de**: FIX-030 (Cartesia opcional).

### [ ] FIX-012 — Memory pipeline órfão
- **Problema**: `MemoryPipeline` escrito mas **nunca instanciado**; `compactionLog` nunca escrito.
- **Evidência**: `apps/worker/src/memory/pipeline.ts:64`.
- **Passos**: 1. Instanciar pipeline no boot/scheduler. 2. Trigger compaction por threshold/turn. 3. Persistir em `compactionLog`.
- **Critério de aceite**: sessão longa → compaction roda + loga.
- **Esforço**: M · **Depende de**: FIX-013.

### [ ] FIX-013 — Dreaming nunca instanciado
- **Problema**: `DreamingGate` com lógica real, **nunca chamado**; turn-engine/CompactionPolicy ausentes.
- **Evidência**: `apps/worker/src/memory/dreaming/gate.ts:15`.
- **Passos**: 1. Definir `DreamingPolicy` (idle/turn triggers). 2. Instanciar gate no memory pipeline. 3. Teste: idle > N → dreaming roda.
- **Critério de aceite**: dreaming dispara em idle configurado.
- **Esforço**: M · **Depende de**: FIX-012.

### [ ] FIX-014 — Telegram é echo placeholder
- **Problema**: polling/pairing ok, mas handler **faz echo placeholder** ("chat routing coming soon"), sem attachments.
- **Evidência**: `apps/worker/src/telegram/bridge.ts:69`.
- **Passos**: 1. Rotear mensagem → chat session → LLM → resposta. 2. Suporte a attachments. 3. Mapear telegram user → sessão.
- **Critério de aceite**: bot conversa de verdade com o usuário.
- **Esforço**: M · **Depende de**: FIX-005.

### [ ] FIX-015 — Lint 99 erros (CI-blocking)
- **Problema**: 5/8 packages com erros; 57 autofixable (import/order), 42 estruturais (28 funções >50 linhas, 9 complexity).
- **Evidência**: auditoria §4; `pnpm lint`.
- **Passos**: 1. `pnpm lint:fix` (zera import/order + consistent-type-imports). 2. Refatorar 28 funções >50 linhas (split subcomponentes/helpers). 3. Reduzir 9 complexity breaches.
- **Critério de aceite**: `pnpm lint` 0 erros em CI.
- **Esforço**: M · **Depende de**: —

### [ ] FIX-016 — Skills sem prompt injection
- **Problema**: CRUD ok, mas skills **não injetadas** no prompt; attach/detach órfãos.
- **Evidência**: `apps/web/components/skills/skill-editor.tsx:58`.
- **Passos**: 1. Resolver skills ativas do agente/sessão. 2. Compor no system prompt (junto c/ FIX-004). 3. Teste.
- **Critério de aceite**: skill ativa aparece no prompt.
- **Esforço**: S · **Depende de**: FIX-004.

### [ ] FIX-017 — MCP HTTP API inalcançável
- **Problema**: `manager.callTool`/`listTools` existem mas **nunca wired a rota** — MCP não usável via API.
- **Evidência**: `apps/worker/src/mcp/manager.ts` + `routes/mcp.ts`.
- **Passos**: 1. Expor `POST /mcp/:server/tools/call` + `GET /mcp/:server/tools`. 2. Permission gate. 3. Teste.
- **Critério de aceite**: chamar tool MCP via HTTP funciona.
- **Esforço**: S · **Depende de**: FIX-006.

---

## P2 — Polish / dívida

### [ ] FIX-018 — Scheduler review morto
- **Problema**: `agent-executor.ts:74` **sempre retorna `validated`** → fila de review é beco sem saída.
- **Passos**: implementar estado `pending_review` + UI de review.
- **Esforço**: M.

### [ ] FIX-019 — WORKER_URL `:3001` errado em knowledge routes
- **Evidência**: `apps/web/app/api/knowledge/{upload,reindex}/route.ts:10`.
- **Passos**: alinhar p/ `:4000` (ou const compartilhada).
- **Esforço**: S.

### [ ] FIX-020 — Sem handler `unhandledRejection`/`uncaughtException` + sqlite-vec swallowed
- **Evidência**: `apps/worker/src/index.ts` (R5); `packages/infra/src/db/client.ts:43-47` (R6).
- **Passos**: 1. Add handlers globais (log + graceful). 2. sqlite-vec load failure → throw (fail-fast) ou flag explícita.
- **Esforço**: S.

### [ ] FIX-021 — 45 casts `as unknown as` evadem `no-explicit-any`
- **Evidência**: 27 em `infra/repos`, 17 em `worker/routes`.
- **Passos**: 1. Helper `mapRow<T>()` p/ fronteira Drizzle→entidade. 2. Add rule `@typescript-eslint/no-unsafe-type-assertion`.
- **Esforço**: M.

### [ ] FIX-022 — ADR-0027 (workflow vivo/morto) pendente
- **Evidência**: `docs/adr/0027-workflow-feature-decision.md` ("Proposto").
- **Passos**: decidir + registrar decisão; implementar/remover WorkflowRun.
- **Esforço**: S.

### [ ] FIX-023 — Atualizar `docs/FEATURE_MATRIX.md` (stale)
- **Problema**: matrix data 2026-06-20 marca ~40 features ⛔ que estão ✅/🟡; G1-G8 marcados abertos mas estão fixed.
- **Passos**: revisitar cada linha vs código real; atualizar status + data.
- **Esforço**: S.

### [ ] FIX-024 — Sidecar Open Design placeholder
- **Problema**: studio page é placeholder; `packages/design-tools` não existe; `vendor/open-design` (106MB) não migrado.
- **Passos**: decidir — migrar design-tools OU remover sidecar do roadmap (S.6).
- **Esforço**: L (se migrar).

### [ ] FIX-025 — PWA parcialmente wired
- **Problema**: deps Serwist instaladas + `next.config` wraps Serwist + `src/sw.ts` existem, **mas** `public/icons/` ausente (Lighthouse PWA < 95), registro/manifest a validar.
- **Passos**: 1. Add manifest + ícones. 2. Validar registro do SW. 3. Lighthouse PWA ≥95.
- **Esforço**: S.

### [ ] FIX-026 — G4 partial: prompt defaults/temperature hardcoded no adapter
- **Problema**: lifecycle de scheduler movido p/ use-case, mas defaults de prompt/temperature ainda hardcoded em `agent-executor`.
- **Passos**: externalizar p/ config/agent; passar via DI.
- **Esforço**: S.

### [ ] FIX-027 — 7 infra repos sem port no domain
- **Problema**: AuthAudit, AuditLog, GlobalRule, McpServer, McpToolRegistry, Secret, TokenUsage têm repo em infra **sem interface no domain**.
- **Passos**: criar `domain/repos/*.ts` p/ cada; fazer infra implementar; usar via DI.
- **Esforço**: M · **Depende de**: FIX-007.

### [ ] FIX-028 — Chat features faltantes
- **Problema**: Title generation (#9), ConfirmDialog (#10), AskQuestionDialog (#11), Artifact detection (#36), Excalidraw inline (#34) — todos ⛔.
- **Passos**: um FIX-filho por feature; priorizar Confirm/Ask (permissões destrutivas) e Title-gen.
- **Esforço**: L.

### [ ] FIX-029 — `lion.ts` 4/7 adapters `throw "not implemented"`
- **Evidência**: `packages/infra/src/ai-providers/lion.ts:54-57`.
- **Passos**: portar adapters faltantes (Ollama/OpenAI/Google/Z.ai/custom) OU declarar unsupported.
- **Esforço**: M.

### [ ] FIX-030 — TTS Cartesia não wired
- **Problema**: ElevenLabs wired; Cartesia nunca usado na rota (`voice.ts:46,68` sempre ElevenLabs).
- **Passos**: factory de provider TTS selecionável.
- **Esforço**: S.

### [ ] FIX-031 — Schemas mortos
- **Problema**: `agentSyncHistory`, `knowledge_benchmarks` migrados mas **0 refs em código**.
- **Passos**: decidir — implementar reader/writer OU dropar tabela.
- **Esforço**: S.

### [ ] FIX-032 — Usage budget endpoint ignorado pela UI
- **Problema**: `/budget` existe mas UI não consome → budget alerts não surfaced.
- **Passos**: add banner/notificação na `usage/` quando budget excedido.
- **Esforço**: S.

---

## Ordem sugerida de execução

**Onda 0 — destravar CI (pré-tudo)**
FIX-033 (typecheck) → FIX-034 (lint:fix + god-file) — main deve ficar verde antes de qualquer push.

**Onda 1 — estabilizar (P0)**
FIX-003b → FIX-001 → FIX-002 → FIX-003

**Onda 2 — fundação Clean Arch (libera wiring)**
FIX-027 → FIX-007 → FIX-008 → FIX-009 → FIX-015 (lint residual)

**Onda 3 — wiring funcional (P1)**
FIX-004 + FIX-016 (rules+skills injection) → FIX-005 (sub-agents) → FIX-006 + FIX-017 (MCP) → FIX-012 + FIX-013 (memory/dreaming) → FIX-011 (voice) → FIX-014 (telegram) → FIX-010 (wrapper)

**Onda 4 — polish (P2)**
FIX-019, FIX-020, FIX-018, FIX-021, FIX-026, FIX-030, FIX-032, FIX-025, FIX-023, FIX-022, FIX-029, FIX-031, FIX-024, FIX-028

---

## Definition of Done do plano

- [ ] Todos os `P0` resolvidos + `pnpm test:cov` dentro dos gates (domain≥95, use-cases≥90, infra≥85, worker≥85, web≥70, auth/voice≥80).
- [ ] `pnpm lint` 0 erros; `pnpm typecheck` 0 erros; `pnpm test` 0 falhas.
- [ ] `pnpm dev` sobe web+worker sem crash; login→chat→features funcionam E2E.
- [ ] Nenhuma rota importa `@wolfkrow/infra` diretamente (Clean Arch §1.1).
- [ ] Zero funcionalidade "placeholder" (lista §1 da auditoria): cada feature conectada ou removida.
- [ ] `docs/FEATURE_MATRIX.md` reflete realidade (FIX-023).
- [ ] App roda localmente end-to-end (web:3000 + worker:4000 + DB único).

---

**Total**: 32 itens (4 P0 · 14 P1 · 14 P2) · esforço agregado estimado ~6–8 semanas-pessoa.
