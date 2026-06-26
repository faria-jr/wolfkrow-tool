# MVP Final Plan v2 — Wolfkrow Tool (Paridade LionClaw + Polimento + Auditoria Rigorosa)

> **Gerado em:** 2026-06-26T11:55:55-0300
> **Supersede:** `docs/mvp_final_plan.md` (v1). Onde houver conflito, este documento prevalece — v1 superestimava algumas faltas que já foram resolvidas (token 30d, seeds de rules, execução de harness/pipeline) e subestimava outras (roteamento de SDK no chat sem agente, isolamento por usuário no worker).
> **Objetivo:** Levar o `wolfkrow-tool` a um MVP em que **todas as funcionalidades existentes e funcionais no LionClaw v3.0 estão presentes, funcionais e iguais-ou-melhores** na stack Next.js 15, com layout redesenhado/polido, integração backend↔frontend correta, zero bug bloqueante e zero trava por usuário.
> **Referência (produto-alvo):** `/Users/juniorfaria/projects/lionclawv1.0`
> **Base da auditoria:** 4 sub-análises independentes (inventário LionClaw, frontend/UX Wolfkrow, backend/SDK/integração Wolfkrow, specs/ADR vs código) cruzadas contra o código real em 2026-06-26.

---

## 0. Sumário Executivo da Auditoria

O Wolfkrow está **substancialmente mais avançado** do que o `FEATURE_MATRIX.md` (snapshot 2026-06-25) declara: harness e pipeline **executam de fato** com loop AI + SSE + monitor ao vivo; seeds de skills/rules/MCP rodam no boot; token já é 30 dias com lock-on-expiry; o provider anthropic-compat (GLM/Kimi/MiniMax/Qwen) está corretamente implementado no runtime de agente. **Porém** restam bugs bloqueantes reais, divergências de layout/UX em relação ao LionClaw, telas de cadastro sem o padrão pedido (tabela + tela de edição com editor markdown), e o Open Design Studio com UI placeholder.

### 0.1 — Status declarado vs código real (correções ao FEATURE_MATRIX)

| Item | FEATURE_MATRIX declara | Código real (auditado 2026-06-26) |
|---|---|---|
| Harness execução AI | 🟡 deferido v1.1 | **DONE** — `apps/worker/src/harness/runner.ts` (loop Planner→Coder→Smoke→Evaluator) + SSE `POST /projects/:id/run` + monitor `ExecutionView` |
| Pipeline execução | 🟡 templates | **DONE** — SSE `POST /projects/:id/phases/:phaseId/run/stream` + multi-turn `awaiting-input` |
| Token auth | 24h≠30d | **DONE** — `jwt.ts:46` `30d` + cookies `maxAge 30d` + lock só no `exp` (`middleware.ts:24`) |
| Seeds Skills/Rules/MCP | bug/ausente | **DONE** — wired em `apps/worker/src/index.ts:82-84,96-97` |
| SDK GLM/Kimi/MiniMax/Qwen | ✅ funciona | **PARCIAL** — funciona via runtime de **agente**; chat **sem agente** roteia errado (cai no Anthropic real) |
| Open Design Studio | ✅ sidecar+iframe | **PARCIAL** — engine worker real e integrada ao pipeline; **sidecar UI é placeholder** e `packages/design-tools` não existe |
| Multi-usuário sem trava | satisfeito (web) | **PARCIAL** — `apps/web/lib/auth.ts` reescreve userId p/ owner; **worker NÃO** → isolamento vaza |

### 0.2 — Itens identificados (consolidado)

**A. Bugs bloqueantes**
1. **Chat FK constraint** — `chat_sessions.agent_id` é `NOT NULL` + FK→`agents.id`; o repo grava `'' ` quando não há agente → `FOREIGN KEY constraint failed`. (Erro exato reportado pelo usuário.)
2. **Roteamento de SDK no chat sem agente** — `mapRegistryProviderToWire` (`apps/worker/src/orchestrator.ts:85-99`) cai no default `anthropic` para `zai/minimax/moonshot/qwen`; chat com modelo GLM/Kimi/MiniMax/Qwen e sem agente vai pro endpoint Anthropic real (falha/cobrança errada).
3. **Provider override cria/duplica registro** — camada web re-slug do `id` ao editar (`provider-form-helpers.ts:21`); deve travar o `id` em modo edição.
4. **Provider edit não carrega campos** — `apiKey` é write-only (secret separado), nunca retorna no GET → form aparece vazio; precisa flag `hasApiKey` + UX "chave definida, deixe em branco para manter".
5. **MCP "lista vazia"** — FE renderiza correto, mas `catch { /* graceful */ }` (`mcp-servers-view.tsx:155`) mascara falha de backend/auth como "sem servidores"; precisa surfacing de erro + verificar retorno do worker.
6. **Isolamento por usuário no worker** — repos do worker filtram por `payload.sub`; requisito é "todos veem tudo". Aplicar owner-rewrite no `apps/worker/src/plugins/auth.ts:58`.

**B. Cadastros / Configs (padrão pedido)**
7. Agents: tela de cadastro a polir; **editar deve abrir tela dedicada** com editor markdown (system prompt) + campos; seleção de provider/LLM disponível e **dinâmica em todos os runtimes** (hoje só `claude-compat`).
8. Skills: tela a polir; **listar como tabela igual Agents**; editar em tela dedicada com editor markdown (já usa MarkdownEditor em modal).
9. Rules: tela a polir; **listar como tabela igual Agents** com editar/excluir/novo; **hoje não há EDIT** (só create/toggle/delete) e usa `<textarea>` cru; editar em tela dedicada com editor markdown.
10. MCP: **listar como tabela igual Agents** com editar/excluir/novo; **hoje não há edit** de servidor existente; polir cadastro.
11. Provider: corrigir override (#3) e carregamento de campos (#4); polir cadastro.
12. **Channel config**: implementar tela de configuração de canais (hoje só Telegram funcional; resto "em breve" estático).

**C. Harness / Pipeline / Projetos**
13. **Tela de execução/monitoramento dedicada** no padrão LionClaw — hoje o monitor existe mas é **inline** em master/detail (off-pattern, confuso); LionClaw abre view full-screen in-page (ProgressBar → SprintListBar → Header com tabs Chat/Sprints/Métricas → conteúdo → ActionButtons → MetricsFooter) com interação multi-turn.
14. **Pipeline sem campo de project path** (harness tem; pipeline não) — assimetria; pipeline não aponta para repositório local pela UI.
15. **Cadastro de projeto**: existe (`harness_projects`, com `projectPath` validado por allowlist) — unificar conceito "Projeto" entre harness e pipeline.
16. **Métricas conforme LionClaw**: dashboard ignora tokens de chat e pipeline; falta breakdown per-phase/per-agent, Coder-vs-Evaluator split, sprint table, cloud/local split, série temporal.

**D. Layout / Frontend**
17. **Redesign do shell** — header/content/footer: dois estilos de header coexistem (`PageHeader` icon-tile vs `text-2xl` inline); Dashboard duplica título com o breadcrumb da Topbar; `<main>` com contrato de altura frágil; sem footer/indicador global de jobs.
18. **Sidebar** — 24 itens agrupados (LionClaw: 13 flat). Itens órfãos: `/settings/providers` e `/settings/voice` só via card do hub Settings (sem entrada no sidebar). Hub Settings duplica 8 de 10 destinos já no sidebar. Ícone do Harness diverge (sidebar `Zap` vs página `Wrench`). Sem seção "execuções ativas/recentes".
19. **Editor markdown** existe (`components/common/markdown-editor.tsx`) mas só wired no Skills; Agents (textarea) e Rules (textarea cru) não usam.
20. **Polish** — botões/diálogos ad-hoc (provider usa overlay manual em vez de `ConfirmDialog`), empty states fracos, formulários inline perpétuos em vez de modais/telas.

**E. Chat**
21. Corrigir FK (#1) e roteamento de SDK (#2). Picker de provider/LLM **já existe** (`model-picker.tsx`, agrupado por provider) — melhor que LionClaw; manter e validar.

**F. Open Design Studio**
22. Tornar a **UI do sidecar funcional** (`apps/sidecar/src/app/studio/page.tsx` é placeholder; `packages/design-tools` ausente) e validar integração com fases `design`/`design_lock` do pipeline (worker já wired).

### 0.3 — Já satisfeito (NÃO retrabalhar, apenas validar na auditoria)
- Token 30 dias + lock-on-expiry (req. explícito do usuário) — **já implementado**.
- Picker de provider/LLM no chat — **já implementado**.
- Provider anthropic-compat (override baseURL/apiKey/model) no runtime de agente — **correto**.
- Project path no harness com validação allowlist — **já implementado**.
- Engine Open Design no worker + integração pipeline (design/design_lock) — **já implementado** (falta só a UI do sidecar).
- Shared-workspace no web (owner-rewrite) — **já implementado** (falta espelhar no worker, item #6).

---

## 1. Princípios e Restrições (binding)

Toda implementação DEVE obedecer aos ADRs e regras do projeto:

- **Clean Architecture** (ADR-0003): `domain → use-cases → infra → presentation`. Sem lógica de negócio em rota/componente.
- **Zod = single source of truth** (ADR-0005): todo contrato novo (channel config, project, run events, hasApiKey) é Zod-first em `packages/shared-types`.
- **Drizzle, sem SQL cru** (ADR-0004); migrations up/down obrigatórias e testadas (inclui a migration de `chat_sessions.agent_id` nullable).
- **SSE para streaming** (ADR-0012); **WebSocket só para PTY** (ADR-0013). Runs de harness/pipeline/chat = SSE.
- **TDD obrigatório** (ADR-0020 / regra `tdd-mandatory`): RED→GREEN→REFACTOR. Cobertura backend ≥85%, frontend ≥70% (≥80% em auth).
- **shadcn/ui + Tailwind v4 + design-tokens** (ADR-0006/0007): nada de `<button>` cru; usar primitivos `ui/`.
- **TanStack Query** (ADR-0009) p/ server-state; **Zustand** (ADR-0008) p/ client-state, sem god-stores.
- **ESLint bars**: arquivo ≤300 linhas, função ≤50 — quebrar telas grandes (harness/pipeline) em sub-componentes.
- **Sem secrets em código** (regra `no-secrets`): provider keys via Vault/keytar; nunca retornar `apiKey` em GET.
- **Sem trava por usuário**: nenhum cadastro pode ser filtrado/limitado por usuário no MVP.

---

## 2. Plano de Implementação

Estruturado em 7 Epics. Cada item: **Problema → Implementação → Arquivos → Critério de aceite**. Ordem respeita dependências (bugs primeiro, depois cadastros, execução, layout, open design, e por fim auditoria).

---

### EPIC 0 — Bugs Bloqueantes (prioridade máxima)

#### 0.1 — Corrigir FK do Chat (`chat_sessions.agent_id`)
- **Problema:** `agent_id NOT NULL` + FK→`agents.id` (`onDelete restrict`); repo grava `session.agentId ?? ''` → FK falha em chat sem agente (e em qualquer agentId inexistente). Reproduzido pelo usuário.
- **Implementação:**
  1. Tornar a coluna nullable e FK `ON DELETE SET NULL`: `packages/infra/src/db/schema/chat.ts:18-20` → `agentId: text('agent_id').references(() => agents.id, { onDelete: 'set null' })` (remover `.notNull()`).
  2. Nova migration drizzle (rebuild de tabela no SQLite) tornando `agent_id` nullable + alterando ação de FK. Migration up/down testada.
  3. Repo: `packages/infra/src/repos/chat-repos.ts:26,48` → gravar `session.agentId ?? null` (nunca `?? ''`), tanto no insert quanto no `onConflictDoUpdate.set`.
  4. (Opcional, robustez) validar existência do agente antes do save quando `agentId` presente; se inexistente, gravar `null` + log.
- **Arquivos:** `schema/chat.ts`, nova migration em `packages/infra/drizzle/`, `repos/chat-repos.ts`, testes em `packages/infra/.../__tests__`.
- **Aceite:** enviar mensagem no chat **sem** agente e **com** agente persiste a sessão sem erro; teste de integração cobre os dois casos; `pragma foreign_keys=ON` mantido.

#### 0.2 — Corrigir roteamento de SDK no chat sem agente
- **Problema:** `mapRegistryProviderToWire` (`apps/worker/src/orchestrator.ts:85-99`) só mapeia anthropic/openai/ollama/openrouter; `zai/minimax/moonshot/qwen` caem no default `'anthropic'`. Chat com modelo GLM/Kimi/MiniMax/Qwen **sem agente** vai pro Anthropic real.
- **Implementação:** mapear provedores compat para `claude-compat:<id>`:
  ```ts
  case 'zai': case 'minimax': case 'moonshot': case 'qwen':
    return `claude-compat:${providerId}`;
  ```
  ou fazer `inferProvider` chamar `resolveClaudeCompatProvider` para esses ids. Garantir que o campo opcional `provider` do `POST /chat/send` (`chat.ts:31`) também resolva corretamente.
- **Arquivos:** `apps/worker/src/orchestrator.ts`.
- **Aceite:** teste unitário: `inferProvider('glm-4.7')`/`'kimi-*'`/`'MiniMax-*'`/`'qwen-*'` retorna o wire `claude-compat:<id>` correto; chat sem agente com modelo compat usa o `ClaudeCompatProvider` (baseURL/apiKey corretos), validado por mock do factory.

#### 0.3 — Provider: override não pode duplicar; travar id em edição
- **Problema:** `resolveProviderId` (`apps/web/components/settings/provider-config/provider-form-helpers.ts:21`) re-slug do `displayName` quando `id` está vazio; renomear um provider em edição pode gerar **novo id → novo registro**. Worker upsert (`provider-config-repo.ts`) está correto (PK `userId::id`).
- **Implementação:** em modo edição (`initial` presente), carregar `initial.id` imutável e **desabilitar o campo id**; `resolveProviderId` nunca recomputa a partir do displayName quando editando. Em criação, manter slug.
- **Arquivos:** `provider-form-helpers.ts`, `provider-form-modal.tsx`, `provider-form-fields.tsx`.
- **Aceite:** editar um provider built-in (override) e salvar atualiza o mesmo registro (sem duplicar); renomear displayName em edição não muda o id.

#### 0.4 — Provider: carregar campos no form de edição
- **Problema:** `apiKey` é write-only (secret via `getAdapters().secrets`), nunca retorna no `GET /api/providers` → form aparece vazio (demais campos carregam OK).
- **Implementação:** worker retorna `hasApiKey: boolean` (não o segredo) em `apps/worker/src/routes/providers.ts` GET; form renderiza campo apiKey como "•••• (definida) — deixe em branco para manter"; salvar com apiKey vazio preserva o segredo existente.
- **Arquivos:** `apps/worker/src/routes/providers.ts`, `provider-config.ts` (não vazar apiKey), `provider-form-fields.tsx`, contrato Zod em `shared-types`.
- **Aceite:** abrir edição de provider mostra todos os campos preenchidos e indica que a chave já existe; salvar sem alterar a chave mantém a chave.

#### 0.5 — MCP: superficiar erro em vez de "lista vazia"
- **Problema:** `catch { /* graceful */ }` (`mcp-servers-view.tsx:155`, e idem `agents-view.tsx:57`, `skills-view.tsx:54`) faz falha de backend/auth parecer "sem registros".
- **Implementação:** distinguir erro de vazio: estado `error` separado de `empty`; exibir banner de erro com retry. Verificar que o worker (`GET /mcp-servers`) retorna o catálogo built-in (15) + custom. Confirmar wiring no boot (`startMcpsAsync`).
- **Arquivos:** `mcp-servers-view.tsx`, `agents-view.tsx`, `skills-view.tsx` (e quaisquer fetchers com catch silencioso).
- **Aceite:** com worker no ar, MCP lista os 15 built-in; com worker offline/401, mostra erro (não "nenhum servidor").

#### 0.6 — Remover isolamento por usuário no worker
- **Problema:** `apps/worker/src/plugins/auth.ts:58` usa `payload.sub` (id real); repos filtram por userId → usuários isolados. Web já reescreve p/ owner (`apps/web/lib/auth.ts:61-65`). Requisito: todos veem tudo.
- **Implementação:** quando `WOLFKROW_SHARED_WORKSPACE !== 'false'` (default on), resolver o owner (`repos.user.findOwner()`, já disponível) e usar o id do owner como `userId` efetivo no worker; manter `sub` para auditoria.
- **Arquivos:** `apps/worker/src/plugins/auth.ts`, testes de plugin.
- **Aceite:** dois usuários distintos enxergam os mesmos agents/providers/skills/mcp/projetos; auditoria ainda registra o `sub` real.

---

### EPIC 1 — Cadastros & Configs (paridade + padrão "tabela + tela de edição com markdown")

> **Padrão único de cadastro** (aplicar a Agents, Skills, Rules, MCP): tela = **DataTable** (Nome/identificador, atributos-chave, status, ações por linha: Editar · Duplicar · Excluir) + botão "Novo". **Editar abre tela dedicada** (`/recurso/[id]/edit`, não modal) com **editor markdown** (`components/common/markdown-editor.tsx`) para o corpo (system prompt / SKILL.md / rule body) + painel lateral de campos estruturados. Reusar um componente `EntityEditScreen` para consistência.

#### 1.1 — Agents
- **Problema:** lista já é tabela; edição é **modal** com system prompt em `<textarea>` (não markdown); provider selector só aparece em runtime `claude-compat`.
- **Implementação:**
  1. Edição em tela dedicada `/agents/[id]/edit` com `MarkdownEditor` para o system prompt + campos (model/runtime/tools/thinking/skills/mcp) em painel lateral.
  2. **Provider/LLM dinâmico em todos os runtimes**: mostrar provider selector também para `cloud`/`codex`/`openrouter`/`ollama`; popular `models` a partir do provider selecionado (não `DEFAULT_MODELS` hardcoded); resetar model ao trocar provider (`model-section.tsx:42-46` já reseta — estender).
  3. Polir cadastro (espaçamento, agrupamento de seções, validação inline).
- **Arquivos:** `components/agents/*` (`model-section.tsx:23,134`, `agent-form-body.tsx`, novo `agent-edit-screen.tsx`), rota `app/(app)/agents/[id]/edit/page.tsx`.
- **Aceite:** editar agent abre tela com editor markdown; trocar provider atualiza a lista de modelos para qualquer runtime; salvar persiste via `UpdateAgentUseCase`.

#### 1.2 — Skills
- **Problema:** já usa MarkdownEditor em modal; lista não é DataTable padronizada.
- **Implementação:** lista como DataTable igual Agents (Nome, Categoria, Status, ações); editar em tela dedicada `/skills/[id]/edit` com MarkdownEditor (SKILL.md + frontmatter) + campos. Polir.
- **Arquivos:** `components/skills/*`, rota `app/(app)/skills/[id]/edit/page.tsx`.
- **Aceite:** Skills lista em tabela com Editar/Excluir/Novo; edição em tela dedicada com markdown.

#### 1.3 — Rules
- **Problema:** **sem EDIT** (só create/toggle/delete); usa `<textarea>` cru e `<pre>` read-only; agrupado em cards.
- **Implementação:** lista como DataTable igual Agents (Nome, Tipo behavior/soul/user/custom, Enabled, ações Editar/Excluir/Novo); **adicionar EDIT** com tela dedicada `/rules/[id]/edit` + MarkdownEditor; backend já tem CRUD (`routes/rules.ts`, `global-rule-repo.ts`) — garantir endpoint de update.
- **Arquivos:** `components/rules/*`, rota `app/(app)/rules/[id]/edit/page.tsx`, validar `UpdateRuleUseCase`.
- **Aceite:** Rules em tabela; editar abre tela com markdown e salva; toggle enable/disable mantido.

#### 1.4 — MCP
- **Problema:** card grid; **sem edit** de servidor existente; add via modal.
- **Implementação:** lista como DataTable (Nome, Source built-in/custom, Status, Visibilidade, ações Editar/Excluir/Novo/Restart/Health); editar em tela dedicada com campos (command/args/env/url/visibility) — built-in editável só na visibilidade. Garantir backend de update.
- **Arquivos:** `components/mcp/*`, rota `app/(app)/mcp-servers/[id]/edit/page.tsx`, `apps/worker/src/routes/mcp.ts` (update handler se ausente).
- **Aceite:** MCP em tabela com os 15 built-in + custom; editar custom funciona; built-in permite trocar visibilidade.

#### 1.5 — Provider (polimento, pós-bugs 0.3/0.4)
- **Implementação:** após corrigir override/edit, padronizar UI (usar `ConfirmDialog` compartilhado em vez do overlay manual de delete `provider-list.tsx:140-173`); manter como modal ou migrar para tela dedicada conforme padrão. Indicar built-in vs custom claramente.
- **Arquivos:** `components/settings/provider-config/*`.
- **Aceite:** CRUD de provider consistente com o restante; delete via ConfirmDialog.

#### 1.6 — Channel config
- **Problema:** só Telegram funcional; demais "em breve" estáticos; sem tela de config genérica.
- **Implementação:** tela de configuração de canais data-driven (catálogo + estado por canal); Telegram com setup real (já existe); demais canais expostos como "em breve" data-driven (paridade LionClaw) OU implementar config de credenciais/habilitação por canal conforme `channels` schema. Mínimo de paridade: Telegram funcional + estrutura de config consistente.
- **Arquivos:** `components/channels/*`, `apps/worker/src/routes/telegram.ts` (+ futuros), `schema/channels.ts`.
- **Aceite:** tela de canais mostra config do Telegram funcional; estrutura permite adicionar novos canais sem reescrever a tela.

#### 1.7 — Auth/Token (validação apenas)
- **Status:** já 30 dias + lock-on-expiry. **Nenhuma alteração de código.**
- **Aceite (auditoria):** confirmar `jwt.ts:46` `30d`, cookies `maxAge 30d` (`login/unlock/totp`), e `middleware.ts:24` redireciona só quando `exp*1000 <= now`. Atualizar ADR-0017 / SPEC-001 (drift de doc: 7d→30d).

---

### EPIC 2 — Harness / Pipeline / Projetos (execução, monitor dedicado, métricas)

#### 2.1 — Tela de execução/monitoramento dedicada (padrão LionClaw)
- **Problema:** monitor existe mas é **inline** em master/detail (`harness-view.tsx`, `pipeline-view.tsx`), off-pattern e confuso; LionClaw usa view full-screen in-page coesa.
- **Implementação:** criar `RunConsole` dedicado (rota `/harness/[id]/run` e `/pipeline/[id]/run`, ou painel full-bleed que substitui a lista) replicando a estrutura LionClaw:
  - Topo: **ProgressBar** de fases/sprints (chips clicáveis; fases concluídas abrem histórico read-only).
  - **Header** do run: voltar, nome do projeto + "Fase N / Sprint N", tabs **Chat | Sprints | Métricas**, badge do modelo, **badge do project path** (Folder), badge de status + Pause/Resume/Abort.
  - **Conteúdo** por modo: Chat (multi-turn `PipelineChatView`/`phase-stream-view`), Sprints (`ExecutionView` com painéis Coder/Evaluator lado a lado, round history), Métricas (footer/tabela).
  - **ActionButtons** (Aprovar/Rejeitar/Continuar) + **MetricsFooter**.
  - Estado de UI mutuamente exclusivo: `done > failed > aborted > interrupted > streaming > awaiting-input > paused > idle`.
- **Arquivos:** novos `components/run-console/*`, refactor `components/harness/*` e `components/pipeline/*` (quebrar em ≤300 linhas), rotas `app/(app)/{harness,pipeline}/[id]/run/page.tsx`. SSE já existe (`/projects/:id/run`, `/phases/:phaseId/run/stream`).
- **Aceite:** clicar Run abre console dedicado com monitor ao vivo, interação multi-turn e métricas; harness e pipeline compartilham o mesmo shell de console; layout coeso (não inline no master/detail).

#### 2.2 — Pipeline: campo de project path + conceito unificado de Projeto
- **Problema:** pipeline não tem campo de project path (harness tem); `harness_projects` já modela `projectPath` validado por allowlist.
- **Implementação:** adicionar campo **Caminho do Projeto** ao create do pipeline (`PipelineLeftPanel`/wizard) com seletor de diretório; reusar `validateProjectPath`. Unificar conceito "Projeto" (mesma tabela/serviço) entre harness e pipeline, com tela de **cadastro de projeto** (Nome, Path, Spec, descrição) reaproveitada.
- **Arquivos:** `components/pipeline/*`, `apps/worker/src/routes/pipeline.ts`, `schema/pipeline.ts` (link `harnessProjectId` já existe), `lib/project-path.ts`.
- **Aceite:** pipeline aponta para repositório local pela UI; path validado por allowlist; execução usa `workDir = projectPath`.

#### 2.3 — Métricas conforme LionClaw
- **Problema:** dashboard ignora tokens de chat e pipeline; sem breakdown per-phase/per-agent, Coder-vs-Evaluator split, sprint table, cloud/local split, série temporal.
- **Implementação:**
  - Dashboard: KPIs incluindo **chat + harness + pipeline** (tokens, custo, projetos, runs ativos) + sparkline/trend (hoje vs semana) + saúde de MCP/queue.
  - Run console: per-phase (inputTokens, outputTokens, cache, costUsd, durationMs, toolUses, apiRequests, model, runtime), totals com **cloud/local split**, per-round Coder/Evaluator (model+tokens+cost+duration), **pass rate** color-coded, **sprint table** (rounds, coder$, evaluator$, total$, tokens in/out, duração, verdict).
  - Reusar dados existentes (`MetricsPanel`, `SprintMetricsTable`, repos de usage/pipeline).
- **Arquivos:** `components/dashboard/dashboard-view.tsx`, `components/harness/metrics-panel.tsx`, `components/run-console/metrics-*`, `app/(app)/usage/*`.
- **Aceite:** métricas batem com as do LionClaw (per-phase, per-round, Coder/Evaluator split, sprint table, cloud/local); dashboard reflete custo total real (chat incluído).

---

### EPIC 3 — Layout / Redesign / Polimento

#### 3.1 — Redesign do shell (header/content/footer)
- **Problema:** dois estilos de header (`PageHeader` icon-tile vs `text-2xl` inline); Dashboard duplica título com breadcrumb; `<main>` com contrato de altura frágil; sem footer/indicador global de jobs.
- **Implementação:**
  - Padronizar **um** header (`PageHeader` icon-tile) em todas as telas; remover títulos inline duplicados; resolver double-title do Dashboard.
  - Contrato de altura robusto do `<main>` (grid/flex consistente, scroll region única em `PageContent`).
  - **Footer/indicador global** de jobs em execução (harness/pipeline/scheduler) — barra inferior com runs ativos (paridade `PipelinesActiveSidebar`/`ActiveRunsBar`).
  - Design moderno, minimalista, impactante: hierarquia visual, espaçamento, tokens de cor/status centralizados (eliminar mapas de status duplicados por arquivo).
- **Arquivos:** `components/common/{page-shell,page-header,topbar,sidebar,active-runs-bar}.tsx`, `app/(app)/layout.tsx`, `packages/design-tokens`.
- **Aceite:** header único e consistente; sem títulos duplicados; footer global de jobs; scroll/altura estável em todas as telas.

#### 3.2 — Sidebar (revisão completa)
- **Problema/checagens pedidas:**
  - **Itens corretos?** 24 itens mapeiam rotas existentes (OK). Validar nomenclatura/ordem vs LionClaw.
  - **Tela sem caminho no menu?** `/settings/providers` e `/settings/voice` são órfãos (só via hub Settings). Decidir: promover a itens de sidebar (grupo Settings/System) ou manter hub coeso. Recomendado: expor Providers e Voice no grupo apropriado.
  - **Itens duplicados?** Sem entradas duplicadas; **hub Settings duplica 8 de 10 destinos** do sidebar → enxugar hub (deixar só Providers/Voice + atalhos não-navegáveis). Corrigir **ícone do Harness** (sidebar `Zap` ≠ página `Wrench`) — unificar.
  - **Seção de execuções ativas/recentes** (paridade LionClaw): adicionar bloco abaixo da nav.
- **Implementação:** ajustar `lib/nav.ts`, `components/common/sidebar.tsx`, `settings-view.tsx`. Considerar agrupar para reduzir carga cognitiva (LionClaw é flat 13; manter grupos mas coesos).
- **Aceite:** nenhum item órfão sem caminho; sem duplicação funcional (hub enxuto); ícones consistentes; bloco de execuções ativas presente.

#### 3.3 — Editor markdown reusado em Agents e Rules
- **Problema:** `markdown-editor.tsx` só wired no Skills.
- **Implementação:** usar `MarkdownEditor` no system prompt do Agent (1.1) e no body de Rules (1.3), com tabs Edit/Preview + suporte a frontmatter onde aplicável.
- **Aceite:** Agents, Skills e Rules usam o mesmo editor markdown.

#### 3.4 — Polish de componentes
- **Implementação:** substituir botões/diálogos ad-hoc por primitivos `ui/` (`ConfirmDialog` em provider delete); skeletons de loading; empty states com CTA; migrar formulários inline perpétuos (harness/pipeline create) para "Novo" + modal/tela; centralizar mapa de cores de status.
- **Arquivos:** vários em `components/*`.
- **Aceite:** UI consistente, sem `<button>` cru, com skeletons/empty states; sem formulários inline perpétuos.

---

### EPIC 4 — Open Design Studio (UI funcional + integração)

#### 4.1 — UI do sidecar funcional
- **Problema:** `apps/sidecar/src/app/studio/page.tsx` é placeholder de 22 linhas; `packages/design-tools` não existe; engine worker (manager/client/bootstrap/lock/snapshot/contract) é real e integrada ao pipeline (`pipeline-design.ts`).
- **Implementação:** portar a UI do Open Design Studio do LionClaw (`OpenDesignStudioPage` + `Phase4Container`, máquina de 5 estados; embed do `vendor/open-design` Next.js + daemon). Conectar à engine worker (`OpenDesignClient`): start/stop/status/bootstrap/snapshot/lock. Renderizar `artifact.html` + extração do contrato (`<script id="lionclaw-design-contract">`).
- **Arquivos:** `apps/sidecar/src/app/studio/*`, novo `packages/design-tools` (ou consolidar no sidecar), `apps/worker/src/open-design/*` (já existe).
- **Aceite:** abrir Design Studio renderiza a sessão real; criar/lock de design produz `design-contract.json` + `design-brief.md` + snapshot.

#### 4.2 — Integração com pipeline/harness
- **Problema:** validar fases `design`/`design_lock` end-to-end (worker já wired: `runDesignBootstrap`/`runDesignLock`).
- **Implementação:** no run console do pipeline `development-v2`, fase design abre o Studio (full-screen), design_lock congela snapshot para `<projectPath>/docs/.../design/` e libera próxima fase. Garantir 409 tratado quando engine offline (com CTA para iniciar engine).
- **Aceite:** pipeline `development-v2` executa fase design via Studio e trava o design antes da implementação, como no LionClaw.

---

### EPIC 5 — Chat (paridade final)
- **Status:** picker de provider/LLM já existe (`model-picker.tsx`, agrupado por provider). FK (0.1) e roteamento de SDK (0.2) corrigidos no EPIC 0.
- **Implementação:** validar paridade de funcionamento com LionClaw (send-while-streaming queue, anexos de imagem, contador de token/custo/contexto, título automático, ConfirmDialog para tools gated). Garantir que o modelo escolhido no picker resolve o SDK correto (depende de 0.2).
- **Arquivos:** `components/chat/*`, `apps/worker/src/routes/chat.ts`.
- **Aceite:** chat funciona com qualquer provider/modelo selecionado (Anthropic/GLM/Kimi/MiniMax/Qwen/Codex/Ollama) sem erro de FK nem de SDK; paridade de UX com LionClaw.

---

### EPIC 6 — Auditoria Rigorosa Final (gate de release)

> Esta epic é **obrigatória** e bloqueia a release. Objetivo: provar que cada item acima foi realmente implementado, é funcional, sem bug, sem débito bloqueante, com testes que validam o código real (não só mocks). Executar via sub-agents QA por domínio (`spec-qa-backend/frontend/database/devops`) e veredicto determinístico (`qa-verdict.sh`).

#### 6.1 — Checklist por item (aplicar a TODOS os itens dos EPICs 0–5)
Para cada funcionalidade, validar e registrar evidência (file:line + resultado de teste):
- [ ] Item realmente implementado (código existe e é alcançável pela UI).
- [ ] Implementado de forma funcional (executa o caminho feliz end-to-end).
- [ ] Segue a definição deste plano.
- [ ] Clean Code / Clean Arch / SOLID / DRY / YAGNI (sem god-objects; camadas respeitadas; sem código morto).
- [ ] Sem bugs conhecidos / sem débito técnico bloqueante.
- [ ] Testes unitários sem falhas/erros **e que validam o comportamento real** (não apenas mocks sem asserção de efeito).
- [ ] Cobertura: backend ≥85%, frontend ≥70% (≥80% auth).
- [ ] Integração backend↔frontend correta: endpoint, método, contrato Zod, status codes.
- [ ] Frontend: layout moderno/minimalista/impactante, componentes padronizados, sem ambiguidade, boa usabilidade, bem distribuído, reflete todas as funcionalidades.

#### 6.2 — Auditoria funcional dirigida (smoke E2E por fluxo)
Roteiros obrigatórios (Playwright + chamadas de API):
1. **Auth:** setup senha → login → 30d token → navegar sem relock → expirar → relock.
2. **Chat:** sem agente / com agente / cada provider (Anthropic, GLM, Kimi, MiniMax, Qwen, Codex, Ollama) → resposta sem FK/SDK error; persistência de sessão; troca de modelo no picker.
3. **Cadastros (Agents/Skills/Rules/MCP/Provider/Channel):** listar (tabela) → novo → editar (tela dedicada + markdown) → duplicar → excluir; provider override não duplica; provider edit carrega campos; MCP lista 15 built-in.
4. **Harness:** criar projeto c/ path → plan → run → monitor ao vivo (Coder/Evaluator) → métricas → abort/retry.
5. **Pipeline:** criar projeto c/ path → executar fases (conversation multi-turn + loop) → approve gates → report → métricas (per-phase/round, cloud/local split).
6. **Open Design:** pipeline development-v2 → fase design (Studio) → design_lock → artifacts.
7. **Multi-usuário:** dois usuários enxergam os mesmos cadastros (sem trava).

#### 6.3 — Auditoria de código (sub-agents)
- Rodar `wolfkrow-audit` (security/performance/quality/scope) sobre o codebase; **zero BLOCKER/CRITICAL** para aprovar.
- Verificar SDK execution: confirmar via teste que `glm/kimi/minimax/qwen` executam por `ClaudeCompatProvider` com override (baseURL/apiKey/model), tanto no runtime de agente quanto no chat sem agente.
- Verificar ausência de secrets em código (`no-secrets`); `apiKey` nunca em respostas GET.
- Verificar isolamento removido (worker owner-rewrite) por teste de integração com 2 usuários.

#### 6.4 — Gate de aprovação
- Veredicto determinístico (`qa-verdict.sh`): release só `done` se nenhum item em `blocked` e nenhum finding BLOCKER/CRITICAL/MAJOR aberto.
- Atualizar `FEATURE_MATRIX.md` (regenerar contra código real), ADR-0017/SPEC-001 (30d), e `MVP_VALIDATION.md` com os resultados da auditoria.

---

## 3. Ordem de Execução Recomendada

1. **EPIC 0** (bugs bloqueantes) — desbloqueia chat e SDK; corrige duplicação de provider e isolamento.
2. **EPIC 1** (cadastros) — padrão tabela + tela de edição com markdown; channel config.
3. **EPIC 2** (harness/pipeline/projetos + métricas) — run console dedicado + project path + métricas.
4. **EPIC 3** (layout/redesign/polimento) — shell, sidebar, editor markdown, polish.
5. **EPIC 4** (Open Design Studio) — UI funcional + integração.
6. **EPIC 5** (chat parity) — validação final pós-bugs.
7. **EPIC 6** (auditoria rigorosa) — gate de release.

> Cada item deve passar por TDD (RED→GREEN→REFACTOR) e worktree isolation conforme regras do projeto. Nenhum item é "done" sem teste que valide o comportamento real e sem aprovação no checklist 6.1.

---

## 4. Apêndice — Mapa rápido de arquivos load-bearing

| Domínio | Arquivos |
|---|---|
| Chat FK | `packages/infra/src/db/schema/chat.ts:18`, `repos/chat-repos.ts:26,48`, `use-cases/src/chat/send-message.ts:63` |
| SDK routing | `apps/worker/src/orchestrator.ts:85-99,173-184`, `packages/infra/src/ai-providers/{claude-compat,factory}.ts`, `packages/domain/src/services/{provider-registry,claude-compat-presets}.ts` |
| Provider form | `apps/web/components/settings/provider-config/{provider-form-helpers,provider-form-modal,provider-list}.tsx`, `apps/worker/src/routes/providers.ts`, `repos/provider-config-repo.ts` |
| Agent provider/model | `apps/web/components/agents/model-section.tsx:23,134`, `agent-form-body.tsx`, `schema/agents.ts` |
| Auth/token | `packages/infra/src/auth/jwt.ts:46`, `apps/web/middleware.ts:24`, `app/api/auth/{login,unlock,totp}/route.ts` |
| Isolamento | `apps/web/lib/auth.ts:54-71`, `apps/worker/src/plugins/auth.ts:58` |
| Harness/Pipeline | `apps/worker/src/harness/runner.ts`, `routes/{harness,pipeline,pipeline-design}.ts`, `lib/project-path.ts`, `components/{harness,pipeline}/*` |
| Open Design | `apps/worker/src/open-design/*`, `apps/sidecar/src/app/studio/page.tsx` (placeholder) |
| Sidebar/Shell | `apps/web/lib/nav.ts`, `components/common/{sidebar,topbar,page-shell,page-header}.tsx`, `settings-view.tsx` |
| Markdown editor | `apps/web/components/common/markdown-editor.tsx` |
| LionClaw ref | `src/types/pipeline.ts:57-145`, `src/pages/PipelinePage.tsx`, `electron/main/{orchestrator,claude-compat-sdk,open-design}/*`, `src/components/agents/AgentFormModal.tsx` |
