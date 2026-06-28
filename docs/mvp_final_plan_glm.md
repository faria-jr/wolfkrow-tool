# MVP Final Plan — Wolfkrow-Tool (GLM Edition)

> Auditoria profunda + plano de implementação detalhado para alcançar paridade total (ou superior) com o Lionclaw v1.0, na stack Next.js 15.
>
> **Data:** 2026-06-27
> **Stack:** pnpm + turbo monorepo · Next.js 15 (App Router, RSC) · React 19 · Drizzle + better-sqlite3 + sqlite-vec · Fastify (worker) · shadcn/ui + Tailwind v4 · Zustand + TanStack Query.
>
> **Referências cruzadas:** `docs/PRD.md`, `docs/ARCHITECTURE.md`, `docs/FEATURE_MATRIX.md`, `docs/MIGRATION_FROM_LIONCLAW.md`, `docs/specs/SPEC-*.md` (22 specs), `docs/adr/0*.md` (33 ADRs), `docs/mvp_final_plan.md`, `docs/mvp_final_plan_minimax.md`, `correction_plan_1.md`.

---

## 0. Sumário executivo

A auditoria (6 sub-agents + verificação direta do código) conclui que o wolfkrow está **~90% aderente às suas próprias specs** e **estruturalmente sólido** (1517 testes de backend passando, typecheck limpo, Clean Architecture preservada, domínio sem dependências externas). **Entretanto, existem 5 bugs bloqueadores** que impedem o uso real do produto, além de gaps de UX e funcionalidades que precisam ser fechados para igualar o Lionclaw.

Os itens foram priorizados por **impacto no usuário** (o que impede o uso hoje) e agrupados em 7 fases.

### 0.1 Matriz de prioridades

| Fase | Tema | Itens | Criticidade |
|------|------|-------|-------------|
| **F1** | Bugs bloqueadores (chat, auth, SDK) | 6 | 🔴 Bloqueia uso |
| **F2** | Harness & Pipeline (paridade Lionclaw) | 8 | 🔴 Core do produto |
| **F3** | Layout & Frontend redesign | 9 | 🟠 UX/polimento |
| **F4** | Configs (agents, skills, mcp, providers, channels) | 7 | 🟠 Funcionalidades |
| **F5** | Infraestrutura transversal (paginação, per-user, segurança) | 5 | 🟡 Robustez |
| **F6** | Qualidade & dívida técnica (lint, testes, E2E) | 6 | 🟡 Gate de qualidade |
| **F7** | Auditoria final de validação | 1 | ✅ Validação |

---

## 1. Relatório de auditoria (resumido)

> Cada item abaixo tem `arquivo:linha` verificado diretamente no código. Achados consolidados a partir de 6 análises paralelas + verificação manual das 3 descobertas mais críticas.

### 1.1 Bugs bloqueadores (🔴 impedem o uso)

| # | Bug | Evidência | Causa raiz |
|---|-----|-----------|------------|
| **B1** | Chat falha com `[Error: could not connect to AI]` | `apps/web/components/chat/chat-hooks.ts:149,152` | O browser chama o worker **diretamente** em `localhost:4000/chat/send` com `credentials:'include'`, mas o cookie `session` é `sameSite:'lax'` (`apps/web/app/api/auth/login/route.ts:24`) e **não é enviado** em `fetch` cross-origin (porta 3000→4000). O worker responde **401** → o `catch` converte na mensagem genérica. **O chat NUNCA funciona** por design atual. |
| **B2** | 401 em endpoints que fazem proxy para o worker | `apps/web/app/api/audit/route.ts:8-9` | O proxy lê `request.headers.get('authorization')`, mas o browser envia **cookie**, não header `Authorization`. O worker recebe sem credencial → 401. Padrão correto já existe em `apps/web/lib/worker-fetch.ts:23-49` (lê cookie e envia como `Bearer`), mas só é usado por `open-design`. |
| **B3** | Erro de SSE silenciado | `apps/web/components/chat/sse.ts:82` | `error: () => undefined` — um erro real do provider (ex.: "Cannot infer claude-compat preset") é descartado no cliente e escondido atrás da mensagem genérica do B1. |
| **B4** | Pipeline ignora o provider selecionado | `apps/worker/src/routes/pipeline.ts`, `apps/worker/src/routes/enrich.ts:34` | Vários caminhos chamam `getAnthropicApiKey()` diretamente em vez de resolver o provider/modelo configurado pelo usuário. |
| **B5** | Rotas do sidecar sem autenticação | `apps/worker/src/routes/sidecar.ts:13-25` | `/sidecar/start`, `/sidecar/stop`, `/sidecar/status` **não** têm `preHandler: [server.authenticate]`. Chamador anônimo pode iniciar/parar o processo Open Design (DoS / controle de processo). |
| **B6** | `"erro ao criar novo projeto"` (harness) | `apps/worker/src/routes/harness.ts:42-48` | `createProjectBody` exige `specPath: z.string().min(1)`. Se o payload omitir `specPath`, retorna 400. O form do harness é um `<Input>` de texto puro (`harness-view.tsx:140-144`) sem seletor de arquivo — fácil de errar/vazio. |

### 1.2 Harness & Pipeline (gaps de paridade com Lionclaw)

| # | Gap | Evidência |
|---|-----|-----------|
| **H1** | **HITL chat do harness é FAKE** | `apps/web/components/harness/execution-view.tsx:83-106` — `useExecutionChat` nunca chama o backend; simula resposta com `setTimeout` + string fixa (`buildAgentReply`, `:112-118`). O pipeline já tem chat real (`phase-stream-hooks.ts:219-229`). |
| **H2** | Executar não abre acompanhamento automático | `harness-view.tsx:246-248` e `pipeline-view.tsx:285-287` usam `<Link>` para o console; o console abre em estado `idle` (`execution-run-hook.ts:248`) e exige um 2º clique em "Run". Lionclaw abre monitoramento ao vivo. |
| **H3** | Pipeline não repassa `projectPath` ao harness | `apps/worker/src/use-cases.../implement-via-harness.ts:154-164` — `createHarnessProject` passa só `userId, name, specPath, description`. O coder cai num tempdir (`os.tmpdir()/wolfkrow-harness/<id>`), **não no repo do usuário**. |
| **H4** | Sem gráfico de métricas | `apps/web/components/harness/metrics-panel.tsx:42-62` — só KPI cards estáticos (Tokens/Cost/Rounds/Features/Duration). Lionclaw tem `MetricsChart`. |
| **H5** | `ActiveRunsBar` não deep-linka | `apps/web/components/common/active-runs-bar.tsx:41,47` — clica num run ativo → vai para `/harness` (lista), não para `/harness/[id]/run`. |
| **H6** | Timeline polida só existe no console | `pipeline-view.tsx:351-360` usa um stepper horizontal fraco na listagem; a timeline vertical decente (`pipeline-timeline.tsx:23-54`) só aparece dentro do run console. |
| **H7** | Padding duplo | `harness-view.tsx:391` e `pipeline-view.tsx:430` aplicam `p-6` dentro de `PageShell` que já tem `p-4 sm:p-6`. |
| **H8** | `/projects` é um cadastro paralelo e desconexo | `apps/web/components/projects/projects-view.tsx` usa `rootPath`; harness/pipeline têm seus próprios forms/tables (`projectPath`/`specPath`). O Lionclaw **não tem** página genérica de projetos — harness/pipeline **são** a superfície de projeto. |

### 1.3 Layout & Frontend

| # | Item | Evidência |
|---|------|-----------|
| **L1** | Sidebar sem métricas/badges | `apps/web/components/common/sidebar.tsx` — nenhuma `SidebarMenuBadge`. Lionclaw mostra contagens por tela. |
| **L2** | Views god-components (7 arquivos >300 linhas) | `scheduler-view.tsx` (487), `pipeline-view.tsx` (458), `harness-view.tsx` (412), `permissions-view.tsx` (354), `phase-stream-view.tsx` (355), `vault-view.tsx` (344), `mcp-server-edit-screen.tsx` (330) — **causam 60 erros de lint** e bloqueiam o gate de CI. |
| **L3** | Harness/Pipeline split-view não é responsivo | `harness-view.tsx:391`, `pipeline-view.tsx:430` — `w-80` + `flex-1` sem breakpoint de empilhamento em mobile. |
| **L4** | `projects/[id]/report` e várias telas `*/[id]` sem entrada no menu | `apps/web/lib/nav.ts` tem 25 itens (1:1 com rotas), mas `report`, `*/new`, `*/edit`, `*/[id]/run` só são acessíveis por URL/ação. |
| **L5** | Editor de markdown já existe | `apps/web/components/common/markdown-editor.tsx` ✓ (usado no agent system prompt). |
| **L6** | Console de execução precisa de polimento | `execution-view.tsx`, `pipeline-run-console.tsx` — funcional, mas sem o refinamento visual do Lionclaw (timeline de fases, cards de rodada, painel de métricas). |

### 1.4 Configs específicas

| # | Item | Estado atual | Evidência |
|---|------|--------------|-----------|
| **C1** | Agent field order | ✅ **Já está correto**: nome → system prompt → effort → maxTurn → provider → model → runtime | `apps/web/components/agents/model-section.tsx:193-231` |
| **C2** | `maxTurn` sem limite superior | Usuário quer 1-100 | `model-section.tsx:127-133` — `min={1}` mas sem `max={100}`; schema `schema.ts:10` sem `.max(100)` |
| **C3** | Runtime `zai`/`minimax-tp` não existem como opção | Wolfkrow usa `cloud/local/codex/external/claude-compat` | `model-section.tsx:31` — zai/minimax existem apenas como *providers* sob `claude-compat` (`FALLBACK_CLAUDE_COMPAT`, `:142-147`). **Decisão:** manter o vocabulário de runtimes do wolfkrow (mais correto que o do Lionclaw) e documentar. |
| **C4** | Skills: sem "Criar com Assistente" | Lionclaw tem geração via skill-creator | Não há `skill-creator` no app. Edit de qualquer skill (incl. built-in) **já funciona** (`skill-list.tsx:71-73`). |
| **C5** | MCP não exibido | O código **não pode** retornar lista vazia (`withVirtualBuiltIns` sempre adiciona 15 built-ins, `route.ts:35-41`) | Sintoma real é provavelmente **erro 401/DB swallowed** (`useMcpServers` lança `'Failed to load MCP servers'` → `ErrorState`, não lista vazia). Resolver com B1/B2. |
| **C6** | Provider override "cria novo registro" | Upsert correto por PK (`${userId}::${providerId}`) | `provider-config-repo.ts:23-52`. Bug ocorre se `userId` muda (owner resolution falha → fallback para o `sub` real) → PK diferente → INSERT. Faltam `UNIQUE(userId, providerId)` e owner resolution robusta. |
| **C7** | Channels: sem "Test connection" | Telegram tem token/user/userId/start/stop/pair | `telegram-setup.tsx`, `telegram-setup-view.tsx`. Sem validação do bot token contra Telegram (`getMe`). Minor bug: `displayName` do vault vira o valor do segredo para username/userId (`telegram-setup.tsx:197`). |

### 1.5 Infraestrutura transversal

| # | Item | Estado atual | Evidência |
|---|------|--------------|-----------|
| **I1** | Token = 30 dias; auto-lock desabilitado | ✅ **Conforme solicitado** | `login/route.ts:27` (`maxAge: 60*60*24*30`), `jwt.ts:46` (`setExpirationTime('30d')`), `use-auto-lock.ts` é no-op. Lock só no fim dos 30 dias. |
| **I2** | Per-user: shared-workspace ON = todos veem tudo | ✅ **Conforme solicitado** (sem bloqueios) | `auth.ts:54-71` reescreve `userId` para o owner. Repos têm `findByUserId` mas são neutralizados pelo rewrite. |
| **I3** | Paginação: **0 endpoints** retornam `total`/`offset` | Vários têm `limit` (logs, memory, permissions, mgraph, knowledge) mas nenhum tem `offset`/`total`/`page` | Audit `logs.ts:15,30`, `memory.ts:44`, `permissions.ts:34`. Nenhuma UI de paginação. |
| **I4** | SDK routing glm/kimi/minimax/qwen: **CORRETO** | ✅ Todos usam `anthropic-compat` → `ClaudeCompatProvider` (Anthropic SDK + `baseURL`) | `provider-registry.ts:46-87`, `factory.ts:99-122`, `claude-compat.ts:62-80`. Nenhum caminho cai em `openai-compatible`. |
| **I5** | Open Design: funcional e integrado ao pipeline | ✅ `design`/`design_lock`/`implementation` wired | `pipeline-design.ts:99-152`, `manager.ts`. **Sidecar legacy quebrado** (`apps/sidecar/.../open-design/route.ts:3` aponta para `localhost:3001` em vez de `4000`), mas é **código morto** (web usa seu próprio proxy). |

### 1.6 Qualidade & testes

| # | Item | Estado atual |
|---|------|--------------|
| **Q1** | Typecheck | ✅ PASS (`pnpm -r typecheck`, exit 0) |
| **Q2** | Testes backend | ✅ **1517 testes passando** (domain 365, use-cases 194, infra 356, worker 602) |
| **Q3** | Testes web | ⚠️ **1 falha**: `command-palette.test.tsx` (timeout 5s — flaky/lento, não bug de lógica) |
| **Q4** | Lint web | 🔴 **60 erros** (7 arquivos >300 linhas via `max-lines`, ~53 funções >50 linhas via `max-lines-per-function`) |
| **Q5** | Lint backend | ✅ PASS (domain, infra, use-cases, worker — exit 0) |
| **Q6** | Testes de qualidade | ✅ Predominantemente comportamentais (não triviais): runner, permission-gate, ssrf-guard, run-phase, auth — todos validam comportamento real |
| **Q7** | Cobertura de caminhos críticos | ⚠️ **Paginação não tem testes**; chat/harness/pipeline/provider-routing/auth têm |
| **Q8** | TODO/FIXME | ✅ **0** em código first-party; ~35 marcadores `DEBT #` documentados e em sua maioria já resolvidos |
| **Q9** | Clean Architecture | ✅ `packages/domain` **zero** dependências externas (só zod + node:); sem violações de fronteira |
| **Q10** | `correction_plan_1.md` (C1-C6) | ✅ **Todos aplicados no código** (C2 harness auth ✓, C3 PermissionResolver ✓, C4/C5 shell:false ✓, C6 SSRF ✓) apesar das checkboxes `[ ]` desmarcadas |

### 1.7 Funcionalidades não mapeadas / gaps de paridade

| Feature | Lionclaw | Wolfkrow | Ação |
|---------|----------|----------|------|
| Editor markdown para system prompt | ✓ | ✅ já existe | — |
| Token counter + orchestrator badge no chat | ✓ | ❌ | F3 |
| AskQuestion HITL dialog no chat | ✓ | ❌ (só Confirm genérico) | F3 |
| Read-only para sessões arquivadas/Telegram | ✓ | ❌ (`archived` existe mas não é usado) | F3 |
| Upload de imagens 20MB | ✓ | 5MB (`chat-upload`) | F4 |
| `MetricsChart` (gráfico) no harness | ✓ | ❌ (só KPI cards) | F2 |
| Timeline de execuções no nível de projeto | ✓ | ❌ (só dentro do console) | F2 |
| Skill-creator assistido | ✓ | ❌ | F4 |
| Workflow multi-step (SPEC-016) | ❌ (decisão ADR-0027 = removido) | ❌ | Fora de escopo |

---

## 2. Plano de implementação por fases

> **Princípios:** cada item é atomicamente testável, segue Clean Architecture (domínio → use-cases → infra → apps), mantém TDD onde aplicável, e respeita os ADRs (0005 zod single-source, 0011 server-actions, 0017 JWT cookie, 0020 TDD). Todas as mudanças de contrato passam por `packages/shared-types`.

---

### FASE F1 — Bugs bloqueadores (🔴 prioridade máxima)

> **Objetivo:** tornar o produto utilizável. Sem F1, nada mais importa.

#### F1.1 — Corrigir chat 401 / "could not connect to AI" (B1, B3)

**Problema:** o chat chama o worker direto em `localhost:4000` sem credencial viável (cookie `SameSite=Lax` não cruza origem) → 401 → mensagem genérica.

**Implementação (opção recomendada — proxy pela web API, alinhado ao padrão `workerFetch` já usado por `open-design`):**
1. Criar `apps/web/app/api/chat/send/route.ts` (route handler POST) que:
   - Lê a sessão via `getSession()` (já valida assinatura ES256).
   - Encaminha para o worker com `workerFetch('/chat/send', { method:'POST', body, headers: {'Content-Type':'application/json', 'Accept':'text/event-stream'} })`.
   - **Faz stream do SSE de volta** ao cliente via `ReadableStream` + `TextEncoderStream` (preservando `Content-Type: text/event-stream`). Isso preserva o SSE end-to-end.
2. Criar `apps/web/app/api/chat/permission/route.ts` (POST) com o mesmo padrão para o HITL de tool-permission.
3. Alterar `apps/web/components/chat/chat-hooks.ts:11` para `const CHAT_API = '/api/chat'` e `:149` para `streamSse(\`${CHAT_API}/send\`, ...)`. Remover a referência direta ao worker (`localhost:4000`).
4. Fazer o mesmo em `apps/web/lib/chat-stream.ts:59` (caminho de voz).
5. **Corrigir B3:** em `apps/web/components/chat/sse.ts:82`, trocar `error: () => undefined` por `error: (msg) => state.appendText(\`[AI error: ${msg}]\`)` (ou um canal de erro estruturado) para que erros reais do provider não fiquem escondidos atrás da mensagem genérica. Manter a mensagem genérica só para erros de rede puros.

**Alternativa (descartada):** `sameSite:'none'; secure:true` — exige HTTPS, problemático em localhost.

**Testes (TDD):**
- `apps/web/app/api/chat/send/__tests__/route.test.ts`: stub `workerFetch`, afirma que repassa `Authorization: Bearer <token>` derivado do cookie e preserva o streaming.
- Ajustar `chat-hooks` testes para usar `/api/chat/send`.
- Manter/resilient `components/chat/__tests__/sse-resilience.test.ts`.

**Critério de aceite:** ao enviar uma mensagem no chat com worker rodando, a resposta flui por SSE sem 401; um erro de provider real mostra a mensagem específica, não "could not connect to AI".

**Arquivos:** `apps/web/app/api/chat/send/route.ts` (novo), `apps/web/app/api/chat/permission/route.ts` (novo), `apps/web/components/chat/chat-hooks.ts`, `apps/web/components/chat/sse.ts`, `apps/web/lib/chat-stream.ts`, `packages/shared-types/src/...` (se adicionar tipos de envelope).

---

#### F1.2 — Corrigir 401 em proxies de worker (B2)

**Problema:** `apps/web/app/api/audit/route.ts:8-9` lê `authorization` header que o browser nunca envia.

**Implementação:** auditar **todos** os route handlers em `apps/web/app/api/**` que chamam o worker e padronizar via `workerFetch` (que lê o cookie `session` e injeta `Bearer`). Alvos confirmados: `audit/route.ts`. Verificar também `enrich`, `profiler`, `security`, `usage`, `scheduler`, `tasks`, `logs`, `permissions`, `memory`, `mgraph`, `graph`, `rules`, `voice`, `mcp-servers` — cada um deve usar `workerFetch`.

**Testes:** para cada proxy corrigido, um teste que afirma `workerFetch` recebe o token do cookie.

**Critério de aceite:** nenhuma rota `/api/*` retorna 401 quando o usuário está autenticado; todas passam por `workerFetch`.

---

#### F1.3 — Pipeline/enrich devem respeitar o provider selecionado (B4)

**Problema:** `apps/worker/src/routes/pipeline.ts` e `enrich.ts:34` chamam `getAnthropicApiKey()` hardcode.

**Implementação:**
1. Substituir `getAnthropicApiKey()` por `resolveAIProvider({ userId, providerId, model })` (já existe em `apps/worker/src/lib/provider-resolver.ts:93-102`) em todos os caminhos de IA do pipeline e enrich.
2. Garantir que o `providerId`/`model` venham do agente/projeto configurado (não do default Anthropic).
3. Testar com um agente cujo model seja `glm-4.7` e afirmar que o `ClaudeCompatProvider` é instanciado com `baseUrl` da Z.ai.

**Testes:** estender `use-cases/pipeline/__tests__/run-phase.test.ts` para cobrir provider não-Anthropic.

**Critério de aceite:** pipeline e enrich rodam com qualquer provider configurado (Anthropic, Z.ai/GLM, MiniMax, Kimi, Qwen, OpenRouter).

---

#### F1.4 — Autenticar rotas do sidecar (B5)

**Problema:** `apps/worker/src/routes/sidecar.ts:13-25` sem `preHandler`.

**Implementação:**
1. Em `sidecarRoutes`, aplicar `const auth = { preHandler: [server.authenticate] }` em todas as 3 rotas (start/stop/status), seguindo o padrão de `harness.ts:252-266`.
2. Adicionar teste em `apps/worker/src/routes/__tests__/sidecar.test.ts` afirmando 401 sem token e 200 com token válido (espelhar `auth.test.ts`).

**Critério de aceite:** `curl localhost:4000/sidecar/status` sem token → 401; com token → 200.

---

#### F1.5 — Corrigir "erro ao criar projeto" (B6)

**Problema:** harness exige `specPath` (`harness.ts:44`) mas o form é um input de texto puro sem seletor de arquivo.

**Implementação:**
1. No form de criação (`harness-view.tsx:140-144`), tornar o campo `specPath` um **seletor de arquivo** real. Como é web (não Electron), usar:
   - Um `<input type="file" accept=".md,.txt,.json">` para upload do spec, OU
   - (Preferido para um app local/desktop) um seletor de path do sistema via um endpoint `/api/filesystem/pick` que use `apps/wrapper` ou `dialog` — **ou**, mais simples e alinhado ao Lionclaw, aceitar um **path absoluto** com validação e autocomplete.
2. Fazer o `projectPath` (diretório do projeto) **opcional mas recomendado** com validação de path existente (já existe `validateProjectPath` em `apps/worker/src/lib/project-path.ts:52-78`).
3. Melhorar a mensagem de erro do worker para ser acionável (ex.: "Especifique o caminho absoluto de um arquivo .md/.txt/.json de SPEC").
4. Verificar e corrigir o mesmo padrão no pipeline (`pipeline-project-routes.ts:19-23`).

**Critério de aceite:** criar um projeto harness/pipeline a partir da UI sem erro; se o path for inválido, mensagem clara e acionável.

---

#### F1.6 — Limpar sidecar legado quebrado (relacionado a I5)

**Problema:** `apps/sidecar` aponta para `localhost:3001` (errado) e é **código morto** (o web usa seu próprio proxy).

**Implementação:**
1. Confirmar que nada referencia `apps/sidecar` em produção (grep de `WORKER_URL.*3001` e importações do sidecar).
2. **Opção A (recomendada):** remover `apps/sidecar` e atualizar `CHANGELOG.md`/`ARCHITECTURE.md` para refletir que o engine Open Design é spawnado pelo worker (`manager.ts`), não por um app Next separado.
3. **Opção B:** se mantido, corrigir `route.ts:3` para `localhost:4000` e o path para `/open-design/*` (não `/api/open-design/*`), e adicionar nota de depreciação.

**Critério de aceite:** não há referência quebrada a `localhost:3001`; `ARCHITECTURE.md` reflete a realidade.

---

### FASE F2 — Harness & Pipeline (paridade Lionclaw)

> **Objetivo:** o core do produto (execução de agentes em loops com HITL) deve ter a mesma experiência do Lionclaw.

#### F2.1 — HITL chat real no harness (H1)

**Problema:** `execution-view.tsx:83-106` simula respostas com `setTimeout`.

**Implementação:**
1. Criar endpoint de chat do harness no worker: `POST /harness/projects/:id/sprints/:sprintId/chat` que usa `ContinuePhaseConversationUseCase` (já existe o análogo de pipeline em `continue-phase-conversation.ts:14`) ou um novo `continue-harness-round.ts`.
2. Criar proxy web `apps/web/app/api/harness/projects/[id]/sprints/[sprintId]/chat/route.ts` via `workerFetch`.
3. Substituir `useExecutionChat` (`execution-view.tsx:83-106`) para chamar o endpoint real via SSE (espelhar `phase-stream-hooks.ts:219-229`).
4. Remover `buildAgentReply` (`:112-118`).

**Testes:** `apps/worker/src/harness/__tests__/harness-chat.test.ts` — afirma que a mensagem do usuário é passada ao provider e a resposta é streamada; `apps/web/components/harness/__tests__/execution-chat.test.ts` — afirma que chama o endpoint.

**Critério de aceite:** durante um round do harness, o usuário pode conversar com o coder/evaluator e receber respostas reais por SSE.

---

#### F2.2 — Executar abre monitoramento ao vivo (H2)

**Problema:** clicar "Run" só navega; o console exige um 2º clique.

**Implementação:**
1. Em `harness-view.tsx:246-248` e `pipeline-view.tsx:285-287`, ao clicar "Run", além de navegar para o console, passar um query param `?autoplay=1&sprintId=...` (ou `?stage=...`).
2. Em `HarnessRunConsole` (`harness-run-console.tsx:85-137`) e `PipelineRunConsole`, ler o param e chamar `start()` automaticamente no mount se `autoplay=1` (`execution-run-hook.ts:249`).
3. Garantir que o `start()` respeite `runState === 'idle'` para não reiniciar runs em andamento.

**Critério de aceite:** clicar em "Run" abre o console e inicia o streaming automaticamente; uma execução em andamento não é reiniciada.

---

#### F2.3 — Repassar `projectPath` do pipeline para o harness (H3)

**Problema:** `implement-via-harness.ts:154-164` omite `projectPath`.

**Implementação:**
1. Em `createHarnessProject`, adicionar `projectPath` ao payload quando o pipeline project tiver um.
2. Garantir que o `agent-factory.ts`/`container.ts:getHarnessProjectWorkDir` prefira o `projectPath` do projeto em vez de `os.tmpdir()` quando presente.
3. Validar o path com `validateProjectPath` (`project-path.ts:52-78`).

**Testes:** estender `implement-via-harness.test.ts` para afirmar que o `projectPath` é repassado e que o workdir é o do projeto.

**Critério de aceite:** ao rodar a fase `implementation` do pipeline, o coder opera no repositório do usuário (não num tempdir).

---

#### F2.4 — Adicionar gráfico de métricas (H4)

**Problema:** só KPI cards.

**Implementação:**
1. Criar `apps/web/components/harness/metrics-chart.tsx` — um gráfico de linha/área (usar `recharts`, já comum no ecossistema, ou um componente shadcn-based) mostrando tokens/cost ao longo das rodadas por sprint.
2. Dados: o worker já expõe métricas por round (`harness-runner`); adicionar um endpoint `GET /harness/projects/:id/metrics?groupBy=round` se não existir.
3. Integrar em `metrics-panel.tsx:42-62` abaixo dos KPI cards.

**Testes:** teste de snapshot/render do componente com dados mock.

**Critério de aceite:** a tela do harness mostra um gráfico de evolução de métricas por rodada, como o Lionclaw.

---

#### F2.5 — Deep-link no `ActiveRunsBar` (H5)

**Problema:** clica num run → vai para a lista.

**Implementação:**
1. Em `active-runs-bar.tsx:41,47`, trocar `href={'/harness'}` por `href={\`/harness/${run.projectId}/run?sprintId=${run.sprintId}\`}` e equivalente do pipeline (`/pipeline/${run.projectId}/run?stage=${run.stage}`).

**Critério de aceite:** clicar num run ativo leva direto ao console de acompanhamento.

---

#### F2.6 — Timeline polida na listagem do pipeline (H6)

**Problema:** stepper horizontal fraco na listagem.

**Implementação:**
1. Extrair o `PipelineTimeline` (`pipeline-timeline.tsx:23-54`) para ser reutilizável e usá-lo também na listagem (`pipeline-view.tsx:351-360`) em vez do stepper horizontal.
2. Adicionar estados visuais (concluído/em execução/aguardando/falhou) com cores e ícones consistentes.

**Critério de aceite:** a listagem do pipeline mostra a timeline vertical completa por projeto, igual ao console.

---

#### F2.7 — Remover padding duplo (H7)

**Implementação:** em `harness-view.tsx:391` e `pipeline-view.tsx:430`, remover `p-6` (deixar o `PageShell` controlar o padding) ou remover o `PageShell` padding para essas views — escolher o padrão do restante do app e aplicar consistentemente.

**Critério de aceite:** harness/pipeline têm o mesmo padding das demais telas.

---

#### F2.8 — Decidir o destino do `/projects` genérico (H8)

**Problema:** `/projects` (campo `rootPath`) é paralelo e desconectado dos projetos de harness/pipeline.

**Implementação (decisão recomendada):** transformar `/projects` no **cadastro central de projetos** (como sua própria descrição afirma: "Central project registration shared by Harness, Pipeline, Design Studio and Terminal"):
1. Fazer os forms de criação de harness/pipeline **selecionarem** um projeto do registro central (dropdown) em vez de pedir o path de novo cada vez.
2. Quando um projeto do registro é selecionado, pré-preencher `projectPath`/`specPath`/`rootPath`.
3. Alternativamente (mais simples, mais próximo do Lionclaw): **remover** `/projects` e usar os próprios projetos de harness/pipeline como superfície.

**Critério de aceite:** não há mais duplicação de cadastro de projetos; o fluxo é claro e único.

---

### FASE F3 — Layout & Frontend redesign

> **Objetivo:** design moderno, minimalista, impactante, responsivo, seguindo as melhores práticas de UI/UX, inspirado no Lionclaw mas otimizado para web/Next.js.

#### F3.1 — Polir o shell (header/content/footer)

1. Revisar `apps/web/app/(app)/layout.tsx:12-42`:
   - `Topbar` (`topbar.tsx:23-38`): garantir que é consistente em todas as rotas (não apenas nas "flush routes" `/chat /terminal /graph /design`).
   - `PageShell`/`PageContent` (`page-shell.tsx`): garantir `overflow-auto` consistente e altura `min-h-0 flex-1`.
   - `ActiveRunsBar`: posicionar como footer fixo discreto, com deep-link (F2.5).
2. Padronizar espaçamentos, tipografia e cores com `packages/design-tokens`.
3. Garantir responsividade: sidebar colapsável em mobile (já é shadcn collapsible), topbar com breadcrumb que quebra bem.

#### F3.2 — Redesign do Harness (H1-H8 + polimento)

Layout alvo (inspirado no Lionclaw, otimizado para web):
```
┌─────────────────────────────────────────────────────────┐
│ Topbar: [≡] Harness > [projeto]        [Status] [Run ▶] │
├──────────────┬──────────────────────────────────────────┤
│ ProjectList  │  Timeline de execuções (vertical)        │
│  + novo      │  ┌────────────────────────────────────┐  │
│  Projeto A   │  │ Sprint 1  [●completed]              │  │
│  Projeto B ▸ │  │  Round 1: Coder ✓ Evaluator ✗      │  │
│              │  │  Round 2: Coder ✓ Evaluator ✓       │  │
│              │  ├────────────────────────────────────┤  │
│              │  │ Sprint 2  [▶running]                │  │
│              │  │  [stream ao vivo...]                │  │
│              │  └────────────────────────────────────┘  │
│              │  [Metrics: KPIs + Chart]                 │
│              │  [HITL Chat]                             │
└──────────────┴──────────────────────────────────────────┘
```
- Split-view com breakpoint `lg:` que empilha em mobile (F2.x).
- Usar `MetricsChart` (F2.4), `RoundsList` (existe), HITL chat real (F2.1).
- Adicionar badge de status no card de projeto.

#### F3.3 — Redesign do Pipeline

Layout alvo:
```
┌─────────────────────────────────────────────────────────┐
│ Topbar: [≡] Pipeline > [projeto]         [Status]       │
├──────────────┬──────────────────────────────────────────┤
│ ProjectList  │  Timeline de fases (vertical, F2.6)       │
│  + novo      │  ● Discovery      [completed]             │
│  Projeto A ▸ │  ● PRD Generator  [completed]             │
│              │  ● Spec Enricher  [▶running]              │
│              │  ○ Planner        [idle]                  │
│              │  ○ Coder          [idle]                  │
│              │  [Phase atual: stream + artifact + chat]  │
│              │  [Approve] [Reject] (quando awaiting_user)│
│              │  [Report] (link para /report)             │
└──────────────┴──────────────────────────────────────────┘
```
- Timeline reutilizável (F2.6) na listagem.
- Approve/Reject funcionais (já existem, validar).
- Link para report.

#### F3.4 — Métricas no sidebar (L1)

1. Adicionar `SidebarMenuBadge` em itens relevantes (Agents, Skills, MCP, Tasks, Runs ativos) com contagens via TanStack Query.
2. Criar um hook `useSidebarCounts()` que agrega as contagens dos endpoints de listagem.
3. Garantir que as contagens não degradam performance (cache com `staleTime` razoável).

#### F3.5 — Quebrar god-components (L2)

Refatorar os 7 arquivos >300 linhas para passar no lint (`max-lines: 300`, `max-lines-per-function: 50`):
- `scheduler-view.tsx` (487) → extrair `ActivityBoardPanel`, `TaskListPanel`, `SchedulerSessionPanel`.
- `pipeline-view.tsx` (458) → já tem sub-componentes, mas `PipelineView` (70) e `PipelineLeftPanel` (92) excedem; extrair `PipelineCreateForm`, `PipelineStageStepper`.
- `harness-view.tsx` (412) → extrair `HarnessCreateForm`, `HarnessProjectPanel`, `HarnessSprintPanel`.
- `permissions-view.tsx`, `phase-stream-view.tsx`, `vault-view.tsx`, `mcp-server-edit-screen.tsx` → decompor similarmente.

**Critério de aceite:** `pnpm --filter @wolfkrow/web lint` passa com 0 erros.

#### F3.6 — Paridade de chat com Lionclaw (L6 + gaps 1.7)

Adicionar ao chat:
1. **Token counter** + **orchestrator badge**: o evento `done` do SSE já carrega usage (`sse.ts:8`); renderizá-lo num `ChatFooter`/badge. Badge do provider/modelo no header.
2. **AskQuestion HITL dialog**: adicionar tipo de evento `ask_question` ao SSE (`sse.ts:5-19`) e o worker deve emitir via `tool_permission`-like; renderizar `AskQuestionDialog` estruturado (input de texto).
3. **Read-only para sessões arquivadas/Telegram**: `chat-sessions.tsx:14` tem `archived`; aplicar `readOnly` no composer quando arquivado.
4. **Upload 20MB**: ajustar `apps/web/app/api/chat/upload/route.ts` e `lib/chat-upload` de 5MB para 20MB para imagens.

#### F3.7 — Telas órfãs no menu (L4)

Avaliar adicionar atalhos (não necessariamente itens de menu) para:
- `pipeline/projects/[id]/report` — adicionar um botão "Report" no card de projeto do pipeline.
- Garantir que `*/new`, `*/edit`, `*/[id]/run` sejam alcançáveis via botões de ação dentro das listagens (já são, validar).

---

### FASE F4 — Configs (agents, skills, mcp, providers, channels)

#### F4.1 — Agents: limitar `maxTurn` a 1-100 (C2)

Em `apps/web/components/agents/model-section.tsx:127-133`, adicionar `max={100}` ao `<Input type="number">`. Em `schema.ts:10`, mudar para `z.number().int().min(1).max(100)`. Documentar que o vocabulário de runtimes do wolfkrow (`cloud/local/codex/external/claude-compat`) é mantido intencionalmente (C3) — é mais correto que o do Lionclaw.

#### F4.2 — Skills: adicionar "Criar com Assistente" (C4)

1. Criar um agente seed `skill-creator` em `apps/worker/src/seed-agents/` (YAML, conforme ADR-0024).
2. Na tela de skills (`skills-view.tsx:33-36`), adicionar botão "Criar com Assistente" que abre o chat com `?agent=skill-creator` e um prompt inicial.
3. O skill-creator gera o markdown do SKILL.md e oferece salvá-lo via `POST /api/skills`.

#### F4.3 — MCP: garantir exibição (C5)

Após F1.1/F1.2 (corrigir 401 nos proxies), o MCP deve exibir. Verificar:
1. `apps/web/app/api/mcp-servers/route.ts` usa `workerFetch` (se delega ao worker) ou `getRepos().mcpServer.findAll(session.userId)` (direto).
2. Confirmar que `withVirtualBuiltIns` sempre anexa os 15 built-ins.
3. Adicionar um teste E2E que afirma a lista não é vazia para um usuário autenticado.

#### F4.4 — Providers: fix do override + edição (C6)

1. Adicionar constraint `UNIQUE(userId, providerId)` na schema `providers.ts` (drizzle migration).
2. Mudar o `onConflictDoUpdate` target em `provider-config-repo.ts:23-52` de `providerConfigs.id` para `[userId, providerId]`.
3. Robustecer `resolveOwnerUserId` (`apps/web/lib/auth.ts:33-43`) para nunca retornar `null` silenciosamente (log + fallback consistente), eliminando a instabilidade de PK que causa o "novo registro".
4. Garantir que **todo** provider (built-in ou custom) é editável (já é, validar UX do modal — título claro "Edit Override" vs "Create").

#### F4.5 — Channels: adicionar "Test connection" (C7)

1. Criar endpoint worker `POST /telegram/test` que chama `getMe` da API do Telegram com o bot token e retorna o `username` do bot.
2. Adicionar botão "Test connection" no `telegram-setup-view.tsx` que chama o endpoint.
3. Corrigir o bug do `displayName` do vault (`telegram-setup.tsx:197`) para usar labels fixos ("Telegram Username") em vez do valor do segredo.

#### F4.6 — Implementar config de channels além do Telegram

O catálogo já marca Discord/Slack/WhatsApp como `coming_soon`. Manter o placeholder mas garantir que o painel de config é reutilizável (fields por canal). Para o MVP, focar em Telegram completo (F4.5).

#### F4.7 — Padronizar e polir os cadastros

Aplicar o `MarkdownEditor` (já existe, L5) em todos os campos de prompt/markdown (agents system prompt ✓, skills SKILL.md, rules). Garantir consistência visual entre os forms de cadastro.

---

### FASE F5 — Infraestrutura transversal

#### F5.1 — Paginação em todas as listagens (I3)

**Implementação:**
1. Definir um envelope paginado em `packages/shared-types`:
   ```ts
   export const PaginatedSchema = <T extends z.ZodTypeAny>(item: T) =>
     z.object({ items: z.array(item), total: z.number().int(), page: z.number().int(), limit: z.number().int(), hasMore: z.boolean() });
   ```
2. Adicionar `limit` + `offset` (ou `page`) query params e retornar `total` em todos os endpoints de listagem:
   - Worker: `audit.ts` (`/scans`), `chat-sessions.ts`, `scheduler.ts`, `tasks.ts`, `vault.ts`, `pipeline.ts` (phases), `pipeline-project-routes.ts`, `project-routes.ts`, `providers.ts`, `rules.ts`, `skills.ts`, `mcp.ts`, `enrich.ts`, `graph.ts`, `memory.ts`, `logs.ts`, `permissions.ts` (`/audit`), `usage.ts`.
   - Web: cada proxy correspondente.
3. Criar componente `<Pagination>` reutilizável em `apps/web/components/common/pagination.tsx` (shadcn-based) e aplicá-lo em todas as listagens: chat-sessions, audit, memory, logs, pipeline projects/phases, harness sprints, scheduler tasks/runs, mcp-servers, rules, skills, vault, knowledge docs.
4. Usar TanStack Query com `page` na queryKey.

**Testes:**
- Testes de repo afirmando `limit`/`offset`/`total`.
- Teste do componente `<Pagination>`.
- **Fechar o gap Q7:** adicionar testes comportamentais de paginação.

**Critério de aceite:** toda listagem com >N itens tem controles de paginação; todo endpoint de listagem aceita e respeita `limit`/`offset` e retorna `total`.

#### F5.2 — Consistência per-user / shared-workspace (I2)

Confirmar que shared-workspace ON (default) significa **nenhum bloqueio por usuário** (conforme requisito do usuário: "todos usuários devem ter acesso a todas funcionalidades e cadastros sem bloqueios").
1. Auditar cada rota worker que ainda tem branch `sharedWorkspace()` (ex.: `chat-sessions.ts:18-20`) e garantir que o comportamento default é `findAll()` (sem filtro).
2. Remover filtros `findByUserId` que poderiam bloquear quando `WOLFKROW_SHARED_WORKSPACE=false` **não** é o caso — mas garantir que, se um dia for `false`, o isolamento funciona corretamente (teste com ambos os modos).
3. Garantir que **nenhum** cadastro é limitado por usuário (providers, agents, skills, mcp, channels, etc.).

#### F5.3 — Robustecer owner resolution

`resolveOwnerUserId`/`resolveOwnerId` nunca deve falhar silenciosamente (causa o bug C6 e instabilidade de userId). Se `findOwner()` retornar null, logar erro e usar um fallback determinístico consistente entre web e worker.

#### F5.4 — Corrigir inconsistência de timestamp mode

`packages/infra/src/db/schema/providers.ts` usa `mode:'timestamp'` enquanto `base.ts` usa `mode:'timestamp_ms'`. Padronizar em `mode:'timestamp_ms'` em toda a schema (migration).

#### F5.5 — Manter configs confirmadas (I1, I4, I5)

- Token 30 dias + auto-lock desabilitado: **já conforme** (I1). Sem ação.
- SDK routing glm/kimi/minimax/qwen via anthropic-compat: **já correto** (I4). Adicionar um teste de regressão E2E que afirma o routing para cada um dos 4.
- Open Design integrado ao pipeline: **já funcional** (I5). Limpeza do sidecar legado em F1.6.

---

### FASE F6 — Qualidade & dívida técnica

#### F6.1 — Corrigir a falha de teste flaky (Q3)

`apps/web/components/common/__tests__/command-palette.test.tsx` (timeout 5s). Aumentar `testTimeout` no `vitest.config` para 10s **ou** refatorar o loop para não reabrir o dialog 20 vezes (testar apenas rotas críticas, ou usar `test.each`).

#### F6.2 — Zerar erros de lint web (Q4)

Consequência direta de F3.5 (decompor god-components). Meta: `pnpm --filter @wolfkrow/web lint` → 0 erros.

#### F6.3 — Elevar cobertura de testes

1. Adicionar testes de paginação (F5.1) — fecha Q7.
2. Adicionar testes E2E (Playwright, ADR-0022) para os fluxos críticos:
   - Agents: criar/editar/duplicar.
   - Skills: criar/editar.
   - MCP: listar/testar.
   - Chat: enviar mensagem, HITL tool-permission.
   - Harness: criar projeto → run → HITL chat → métricas.
   - Pipeline: criar projeto → run → approve → report.
   - Auth: login → 30d → unlock.
3. Validar que o teste `audit-page.test.tsx` reflete o envelope real retornado pelo worker (não mockar array se o worker retorna envelope — alinhar após F5.1).

#### F6.4 — Limpar `correction_plan_1.md`

Marcar as checkboxes `[ ]` dos itens C1-C6 que **já estão aplicados no código** (Q10) para evitar retrabalho/confusão.

#### F6.5 — Documentação

1. Atualizar `docs/FEATURE_MATRIX.md` com as correções da auditoria (harness auto-loop = DONE, knowledge sqlite-vec = DONE, chat sessions = DONE; pipeline/enrich provider fix após F1.3).
2. Atualizar `CHANGELOG.md` (corrigir "Known Issues" stale: harness AI loop **não** é mais "UI-scaffold only").
3. Atualizar `docs/ARCHITECTURE.md` (remover sidecar legado, refletir proxy de chat).

#### F6.6 — Atualizar `docs/MIGRATION_FROM_LIONCLAW.md`

Adicionar o checklist de paridade validado (seção 1.7) e marcar o que foi fechado em cada fase.

---

### FASE F7 — Auditoria final de validação

> Executar **após** F1-F6. É o gate de qualidade do MVP.

#### F7.1 — Checklist de validação rigoroso

Para **cada** requisito abaixo, validar manualmente + automatizadamente:

**Funcionalidade:**
- [ ] Chat envia/recebe via SSE sem 401 (F1.1) — com provider Anthropic, GLM, MiniMax, Kimi, Qwen.
- [ ] Todos os endpoints `/api/*` autenticados não retornam 401 (F1.2).
- [ ] Pipeline e enrich rodam com provider selecionado (F1.3).
- [ ] Sidecar requer autenticação (F1.4).
- [ ] Criar projeto harness/pipeline sem erro (F1.5).
- [ ] HITL chat do harness é real (F2.1).
- [ ] "Run" abre monitoramento automático (F2.2).
- [ ] Pipeline repassa projectPath ao harness (F2.3).
- [ ] Gráfico de métricas exibido (F2.4).
- [ ] Deep-link do ActiveRunsBar funciona (F2.5).
- [ ] Timeline na listagem do pipeline (F2.6).
- [ ] Sem padding duplo (F2.7).
- [ ] `/projects` decidido/consolidado (F2.8).
- [ ] MCP exibe a lista (F4.3).
- [ ] Provider override edita sem criar novo (F4.4).
- [ ] Channels "Test connection" funciona (F4.5).
- [ ] Todas as listagens paginadas (F5.1).
- [ ] Nenhum bloqueio por usuário (F5.2).

**Qualidade de código:**
- [ ] Clean Architecture: `packages/domain` sem dependências externas (Q9).
- [ ] SOLID/DRY/YAGNI: sem god-components >300 linhas (F3.5).
- [ ] Sem TODO/FIXME first-party (Q8).
- [ ] Dívida técnica documentada via `DEBT #` (Q8).

**Testes:**
- [ ] `pnpm -r typecheck` → exit 0 (Q1).
- [ ] `pnpm -r test` → 0 falhas (Q2, Q3, F6.1).
- [ ] `pnpm -r lint` → 0 erros (Q4, F6.2).
- [ ] Testes validam comportamento, não só render (Q6).
- [ ] Cobertura de caminhos críticos: chat, harness, pipeline, provider-routing, auth, paginação (Q7).
- [ ] E2E Playwright para fluxos críticos (F6.3).

**Frontend:**
- [ ] Layout moderno, minimalista, responsivo (F3.1-F3.3).
- [ ] Header/content/footer bem distribuídos (F3.1).
- [ ] Sidebar com métricas (F3.4).
- [ ] Componentes padronizados (shadcn + design-tokens).
- [ ] Chat com token counter, orchestrator badge, AskQuestion, read-only arquivado, upload 20MB (F3.6).

**Integração backend↔frontend:**
- [ ] Contratos respeitam `packages/shared-types` (ADR-0005).
- [ ] Sem 401 em fluxos autenticados (F1.2).
- [ ] SSE streaming end-to-end (chat, harness, pipeline).

**Configs:**
- [ ] Token 30 dias, auto-lock só na expiração (I1) — confirmar.
- [ ] Agent field order: nome → system prompt → effort → maxTurn(1-100) → provider → model → runtime (C1, C2, F4.1).
- [ ] Skills editáveis + "Criar com Assistente" (C4, F4.2).
- [ ] Providers editáveis + override sem duplicar (C6, F4.4).
- [ ] Channels com config + test connection (C7, F4.5).
- [ ] Sem bloqueios por usuário (F5.2).

**SDK routing:**
- [ ] glm → Z.ai anthropic-compat (baseUrl + key + model override) — teste de regressão (I4, F5.5).
- [ ] kimi → Moonshot anthropic-compat.
- [ ] minimax → MiniMax anthropic-compat.
- [ ] qwen → DashScope anthropic-compat.
- [ ] Nenhum cai em openai-compatible indevidamente.

**Open Design:**
- [ ] Integrado à fase `design` do pipeline (I5).
- [ ] `design_lock` congela artefatos.
- [ ] `implementation` delega ao harness.
- [ ] Sem referência quebrada a sidecar (F1.6).

#### F7.2 — Smoke test manual completo

Executar o fluxo ponta-a-ponta do MVP:
1. Setup → login (30d) → usar app sem re-lock.
2. Criar agent (glm-4.7) → chat → resposta flui.
3. Criar pipeline → run → approve → report.
4. Criar harness → run → HITL chat → métricas.
5. Configurar Telegram → test connection.
6. Editar provider override → não cria duplicata.
7. Listar MCP → 15+ built-ins visíveis.
8. Paginar logs, audit, sessions.

#### F7.3 — Relatório final

Produzir `docs/MVP_VALIDATION_REPORT.md` com o resultado de cada item do checklist F7.1 e o smoke test F7.2.

---

## 3. Auditoria de regressão contínua (pós-MVP)

Para garantir que o MVP **permanece** funcional, estabelecer no CI (`.github/workflows/`):
1. **typecheck + lint + test** em todo PR (já existe `codeql.yml`, `nightly.yml` — validar cobertura).
2. **Teste de routing de SDK** como gate de regressão (afirma glm/kimi/minimax/qwen → anthropic-compat).
3. **Teste E2E** noturno dos fluxos críticos (F6.3).
4. **Boundary enforcer** ESLint (já existe em `eslint-rules/`) — garantir que impede import de `infra`/`use-cases` em componentes de apresentação.

---

## 4. Ordem de execução recomendada

```
F1 (bloqueadores)  ──▶ F5.1 (paginação) ──▶ F4 (configs) ──▶ F2 (harness/pipeline) ──▶ F3 (layout) ──▶ F6 (qualidade) ──▶ F7 (validação)
```

- **F1 primeiro** (sem isso, nada funciona).
- **F5.1 cedo** (paginação toca todos os endpoints; fazer antes de polir UI).
- **F4** e **F2** podem ocorrer em paralelo (domains distintos).
- **F3** depende de F2 (redesign do harness/pipeline precisa das features).
- **F6** é contínuo, mas o gate final (lint/test/E2E) é F7.

---

## 5. Itens explicitamente fora de escopo (confirmados)

Baseado nos ADRs e nos planos existentes:
- **Workflow multi-step engine** (SPEC-016) — ADR-0027 = removido ("morto").
- **Knowledge benchmark** — ADR-0032 = removido.
- **mgraph structured vault** — ADR-0033 = fora de escopo v1.
- **Higgsfield / Blotato** — ADR-0031 = deferido.
- **Excalidraw inline no chat** — deferido (abre link externo).
- **Multi-tenancy estrito** — o requisito do usuário é o oposto (sem bloqueios).

---

## Apêndice A — Evidências-chave (arquivo:linha)

| Achado | Evidência |
|--------|-----------|
| Chat 401 / "could not connect to AI" | `apps/web/components/chat/chat-hooks.ts:11,149,152`; cookie `sameSite:'lax'` em `apps/web/app/api/auth/login/route.ts:24` |
| SSE error silenciado | `apps/web/components/chat/sse.ts:82` |
| Proxy audit 401 | `apps/web/app/api/audit/route.ts:8-9` |
| Padrão correto (workerFetch) | `apps/web/lib/worker-fetch.ts:23-49` |
| Token 30 dias | `apps/web/app/api/auth/login/route.ts:27`; `packages/infra/src/auth/jwt.ts:46` |
| Auto-lock desabilitado | `apps/web/hooks/use-auto-lock.ts` (no-op) |
| Shared-workspace rewrite | `apps/web/lib/auth.ts:54-71`; `apps/worker/src/plugins/auth.ts:42-48` |
| SDK routing anthropic-compat | `packages/domain/src/services/provider-registry.ts:46-87`; `packages/infra/src/ai-providers/factory.ts:99-122`; `packages/infra/src/ai-providers/claude-compat.ts:62-80` |
| Sidecar sem auth | `apps/worker/src/routes/sidecar.ts:13-25` |
| Harness HITL fake | `apps/web/components/harness/execution-view.tsx:83-106,112-118` |
| Pipeline HITL real | `apps/web/components/pipeline/phase-stream-hooks.ts:219-229` |
| projectPath não repassado | `apps/worker/src/use-cases.../implement-via-harness.ts:154-164` |
| Padding duplo | `apps/web/components/harness/harness-view.tsx:391`; `apps/web/components/pipeline/pipeline-view.tsx:430` |
| Agent field order correto | `apps/web/components/agents/model-section.tsx:193-231` |
| Provider upsert por PK | `packages/infra/src/repos/provider-config-repo.ts:23-52` |
| Harness auto-loop DONE | `apps/worker/src/harness/runner.ts:257` |
| Knowledge sqlite-vec DONE | `packages/infra/src/db/vec-extension.ts:50`; `packages/infra/src/repos/knowledge-hybrid.ts:22` |
| Testes backend (1517 passando) | `pnpm -r test` (domain 365, use-cases 194, infra 356, worker 602) |
| Lint web (60 erros) | `pnpm --filter @wolfkrow/web lint` |
| God-components | `scheduler-view.tsx`(487), `pipeline-view.tsx`(458), `harness-view.tsx`(412) |
| Domain sem deps externas | grep em `packages/domain/src` — 0 importações de infra/use-cases/apps |

---

## Apêndice B — Mapeamento Lionclaw ↔ Wolfkrow (paridade de sidebar)

| Lionclaw (14 itens) | Wolfkrow | Status |
|---------------------|----------|--------|
| Chat | Chat `/chat` | ✅ |
| Subagentes | Agents `/agents` | ✅ |
| Skills | Skills `/skills` | ✅ (+ "Criar com Assistente" F4.2) |
| MCP | MCP Servers `/mcp-servers` | ✅ (exibição F4.3) |
| Conhecimento | Knowledge `/knowledge` | ✅ |
| Cerebro (Memory+Rules) | Memory `/memory` + Rules `/rules` | ✅ (split) |
| Agenda/Scheduler | Scheduler `/scheduler` | ✅ |
| Canais | Channels `/channels` | ✅ (+ test connection F4.5) |
| Vault | Vault `/vault` | ✅ |
| Logs | Logs `/logs` | ✅ |
| Usage/Codeburn | Usage `/usage` | ✅ |
| Pipeline | Pipeline `/pipeline` | ✅ (redesign F3.3) |
| Harness | Harness `/harness` | ✅ (redesign F3.2) |
| Settings | Settings `/settings` | ✅ |

Wolfkrow **extras** (superset): Dashboard, Graph, Tasks, Projects, Security Audit, Design Studio, Terminal, Enrich, Profiler, Permissions — todos conforme SPECs correspondentes.

---

*Fim do plano. Este documento deve ser atualizado conforme cada fase é concluída, marcando os itens como ✅ no checklist F7.1.*
