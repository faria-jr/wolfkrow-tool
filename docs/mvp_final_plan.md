# MVP Final Plan — Wolfkrow Tool (Paridade LionClaw + Melhorias)

> **Gerado em:** 2026-06-25T21:28:53-0300
> **Objetivo:** Levar o `wolfkrow-tool` ao estado de MVP em que **todas as funcionalidades existentes e funcionais no LionClaw v3.0 estão presentes, funcionais e iguais-ou-melhores** na stack Next.js 15, com layout polido, integração backend↔frontend correta e zero débito bloqueante.
> **Referência (produto-alvo):** `/Users/juniorfaria/projects/lionclawv1.0`
> **Base de comparação:** `docs/FEATURE_MATRIX.md`, `docs/MIGRATION_FROM_LIONCLAW.md`, `docs/PRD.md`, `docs/ARCHITECTURE.md`, `docs/specs/SPEC-001..022`, `docs/adr/0001..0033`.

---

## 0. Sumário Executivo da Auditoria

A auditoria cruzou 5 análises independentes (inventário LionClaw, inventário implementação Wolfkrow, mapeamento specs/ADR, auditoria backend/integração, auditoria frontend/UX). Conclusão geral:

**O Wolfkrow tem uma fundação arquitetural sólida e ampla** (monorepo limpo, clean architecture, ~84 rotas de API, ~45 repositórios, todos os domínios modelados, provider anthropic-compat funcionando para GLM/Kimi/MiniMax/Qwen). **Porém, várias funcionalidades centrais do LionClaw estão incompletas, com bug, ou são apenas scaffolding**, e o `FEATURE_MATRIX.md` superestima o status real em pontos críticos.

### Discrepâncias entre status declarado e código real

| Item | FEATURE_MATRIX declara | Código real (auditado) |
|---|---|---|
| Seed de Skills | ✅ feito | **BUG** — seeder existe mas nunca roda no boot |
| Seed de Rules | ✅ feito | **AUSENTE** — não existe seeder de rules |
| Harness (execução AI) | 🟡 descoped v1.1 | **Não atende paridade** — LionClaw executa; sem run/monitor o feature é inalcançável |
| Pipeline (execução) | 🟡 templates ✅ | Run é síncrono `<pre>`, sem stream/monitor/interação |
| Open Design Studio | ✅ sidecar + iframe | **SCAFFOLD** — `apps/sidecar` é placeholder, sem integração pipeline/harness |
| Auth | ✅ completo | Token 24h≠30d (login já corrigido) |
| Channels | 🟡 Telegram | Só Telegram (Slack/Discord/WhatsApp ausentes) |

> **Nota de escopo:** ADR-0031 (Higgsfield/Blotato), ADR-0032 (Knowledge benchmark) e ADR-0033 (mgraph estruturado) são **descopes intencionais** — NÃO são tratados como faltas neste plano. O requisito do usuário ("mínimo = todas funcionalidades funcionais do LionClaw") prevalece sobre os descopes do FEATURE_MATRIX **apenas onde o LionClaw realmente entrega o feature de forma funcional** (caso de Harness/Pipeline execução).

### Itens identificados (consolidado)

**A. Bugs bloqueantes (corrigir primeiro)**
1. Auth: validade do token (24h JWT / 7d cookie) → requisito: **30 dias** em ambos.
2. Seeds de Skills e Rules nunca executam no boot do worker (`seedDatabase()` sem caller runtime); guard global `isAlreadySeeded(users>0)` impede seed pós-onboarding.
3. Provider: editar não carrega campos no formulário (`provider-form-modal` sem `form.reset` no `useEffect`).
4. Provider: "override" cria novo registro em vez de editar (consequência do #3 + fallback `slugify` no `id`).

**B. Paridade central faltante (LionClaw entrega, Wolfkrow não)**
6. Harness: sem endpoint de execução/stream e sem botão "Run"; sem tela de monitoramento ao vivo (Coder/Evaluator stream, métricas, pause/abort).
7. Pipeline: execução síncrona sem tela de acompanhamento/interação (sem `PipelineStreamView`, `PipelineChatView`, progress bar, pause/abort/retry, métricas).
8. Cadastro de path do projeto: **inexistente** — harness/pipeline rodam em diretório temporário (`os.tmpdir()`), não em repositório do usuário.
9. Open Design Studio: placeholder, sem integração com pipeline (fase design + design lock) como no LionClaw development-v2.
10. Métricas: dados existem mas não há visualização (per-phase/per-agent custo, sprint table, cloud/local split).

**C. Melhorias de frontend / layout solicitadas**
11. Dashboard inexistente (Topbar mostra breadcrumb "Dashboard" fantasma).
12. Sidebar: ícones duplicados (`Network` em MCP+Graph; `FileText` em Rules+Usage+Logs), ícone divergente do da página, versão hardcoded, sem seção de "execuções ativas / recentes".
13. Shell: contrato de altura do `<main>` frágil, headers duplicados (Topbar + header por view), sem footer/indicador global de jobs em execução.
14. Chat: sem seletor de provider/LLM in-chat (solicitado pelo usuário).
15. Editor de markdown: inexistente para agents/skills/rules; preview de skill é falso (não renderiza markdown), sem suporte a frontmatter.
16. Polish: botões HTML crus em harness/pipeline, sem skeletons, empty states fracos, formulários inline em vez de modais, mapa de cores de status duplicado por arquivo.

**D. Configs / regras de negócio**
17. Agent edit: troca dinâmica de provider/modelo **funciona**, mas modelo antigo não é resetado ao trocar provider (gap menor).
18. SDK glm/kimi/minimax/qwen via anthropic-compat: **funciona corretamente** end-to-end (sem ação além de validação).
19. Channel config: implementar Slack/Discord/WhatsApp (ou expor "em breve" data-driven como LionClaw).
20. Multi-usuário: scoping por `userId` é pervasivo em todos os repos → **viola requisito** "todos usuários acessam tudo sem filtros/travas".
21. Seeds de MCP: funcionam via catálogo fallback (OK); seed de DB de channels existe mas nunca roda.

---

## 1. Princípios e Restrições (binding)

Toda implementação deste plano DEVE obedecer aos ADRs e regras do projeto:

- **Clean Architecture** (ADR-0003): domínio → use-cases → infra → presentation. Sem lógica de negócio em rota/componente.
- **Zod = single source of truth** (ADR-0005): todo contrato novo (projectPath, channel config, run events) é Zod-first em `shared-types`.
- **Drizzle, sem SQL cru** (ADR-0004); migrations up/down obrigatórias e testadas.
- **SSE para streaming** (ADR-0012): runs de harness/pipeline/chat usam SSE; **WebSocket só para PTY/bidirecional** (ADR-0013).
- **TDD obrigatório** (ADR-0020, regra `tdd-mandatory`): RED→GREEN→REFACTOR. Cobertura: backend ≥85%, frontend ≥70% (≥80% em auth).
- **shadcn/ui + Tailwind v4 + design-tokens** (ADR-0006/0007): nada de botão `<button>` cru; usar primitivos `ui/`.
- **TanStack Query** (ADR-0009) para server-state; **Zustand** (ADR-0008) para client-state, sem god-stores.
- **ESLint** bars: arquivo ≤300 linhas, função ≤50 (SPEC-013) — portar componentes do LionClaw quebrando em sub-seções.
- **Sem secrets em código** (regra `no-secrets`): provider keys via Vault/keytar.

---

## 2. Plano de Implementação

Estruturado em 6 Epics. Cada item traz: **Problema → Implementação → Arquivos → Critério de aceite**. Ordem recomendada respeita dependências (bugs primeiro, depois execução core, depois layout/UX).

---

### EPIC 0 — Correções Críticas (bugs bloqueantes)

> Domínio misto (backend + frontend) — quebrar em stories por domínio na execução. Prioridade máxima: sem isso, o app não tem conteúdo seed e a sessão expira cedo demais.

#### 0.1 — Auth: validade do token = 30 dias
- **Problema:** JWT expira em 24h (`packages/infra/src/auth/jwt.ts:46` `.setExpirationTime('24h')`) e cookie em 7d (`login/route.ts:27`) — descasados; após 24h o middleware rejeita mesmo com cookie presente.
- **Implementação:**
  - `packages/infra/src/auth/jwt.ts:46`: `.setExpirationTime('30d')`.
  - `apps/web/app/api/auth/login/route.ts:27`: `maxAge: 60 * 60 * 24 * 30`.
  - Replicar `maxAge` 30d em `unlock` e `totp` routes.
  - Atualizar ADR-0017 e SPEC-001 (que dizem 7d) com nota da decisão de produto (30 dias) — manter rastreabilidade.
- **Critério de aceite:** token e cookie expiram em 30 dias; sessão sobrevive 25+ dias em teste de `exp`.

#### 0.2 — Seeds: Skills, Rules e Channels rodando no boot
- **Problema:** `seedDatabase()` (`packages/infra/src/db/seed.ts`) só é chamado pela guarda CLI; o worker `main()` (`apps/worker/src/index.ts`) nunca invoca. Skills (`routes/skills.ts` lê só DB), Rules (sem seeder nenhum) ficam vazios. Guard `isAlreadySeeded(users>0)` ainda curto-circuitaria após onboarding.
- **Implementação:**
  - Criar seeders idempotentes por-recurso análogos a `ensureSeedAgents` (que já funciona): `ensureBuiltInSkills(userId)`, `ensureBuiltInRules(userId)`, `ensureBuiltInChannels(userId)`.
  - Cada seeder gateado pela **vacância do próprio recurso** do owner (ex.: "owner tem 0 skills built-in"), NÃO por `users>0`.
  - Criar fonte `BUILT_IN_RULES` (portar `RULES.md`/`SOUL.md`/`USER.md`/`MEMORY.md` defaults do LionClaw).
  - Chamar todos em `apps/worker/src/index.ts main()`, junto de `seedAgentsForExistingUsers()`.
- **Arquivos:** `packages/infra/src/db/seed.ts`, `apps/worker/src/seed-agents/seeder.ts` (padrão), `apps/worker/src/index.ts`.
- **Critério de aceite:** após onboarding + boot, `/api/skills` e `/api/rules` retornam os built-ins; MCP catálogo intacto; idempotente em reboot.

#### 0.3 — Provider: carregar campos ao editar
- **Problema:** `provider-form-modal.tsx:21` usa `defaultValues` só no mount; o modal permanece montado, então editar não popula os campos (falta `form.reset`).
- **Implementação:** adicionar em `apps/web/components/settings/provider-form-modal.tsx`:
  ```ts
  useEffect(() => { form.reset(buildProviderFormValues(initial)); }, [initial, form]);
  ```
  (espelha `agent-form-modal.tsx:69-71`). Campo `apiKey` permanece vazio por design (nunca volta ao cliente); popular `baseUrl/model/displayName/protocol/id`.
- **Critério de aceite:** clicar Editar/Override popula todos os campos visíveis; teste RTL cobrindo reset.

#### 0.4 — Provider: editar não deve criar novo registro
- **Problema:** `provider-form-helpers.ts:21` `id: values.id || slugify(displayName)` — sem `id` no form (consequência do 0.3) gera novo `id` → nova linha. O repo já faz upsert correto por `id` (`provider-config-repo.ts:19`).
- **Implementação:** após 0.3 o `id` é populado; reforçar tornando `id` campo oculto/locked no modo edição (não regenerar via slug quando `initial?.id` existe).
- **Critério de aceite:** editar provider mantém o mesmo `id`/linha; nenhum registro duplicado; teste de integração do save-provider em modo edit.

#### 0.5 — Multi-usuário: acesso compartilhado sem filtros
- **Problema:** `userId` filtra leituras/escritas em ~todos os repos (agents, skills, mcp, providers, knowledge, pipeline, harness, rules, graph, memory, scheduler, vault, etc.). Viola requisito "todos usuários acessam tudo sem travas". Hoje funciona só porque há um único owner.
- **Implementação (decisão de arquitetura):** introduzir um sentinela de ownership compartilhado em vez de editar cada call-site:
  - Opção recomendada: remover o predicado `userId` das queries de **list/get** e das verificações de ownership em update/delete dos recursos compartilháveis (agents, skills, mcp, providers, knowledge, pipeline, harness, rules, graph, memory, scheduler, tasks, audit, usage). Manter `userId` apenas onde for genuinamente pessoal (sessão de auth, audit de login).
  - Centralizar via flag no `RepoRegistry`/container (`SHARED_WORKSPACE=true`) para não espalhar `if`.
  - Cobrir com teste: dois usuários distintos veem o mesmo conjunto de agents/skills/providers.
- **Arquivos:** `packages/infra/src/repos/*-repo.ts`, `packages/infra/src/repos/registry.ts`, `apps/web/lib/container.ts`, `apps/worker/src/container.ts`.
- **Critério de aceite:** segundo usuário criado enxerga e edita os mesmos cadastros do owner; nenhum 403/empty por scoping.

---

### EPIC 1 — Execução e Monitoramento de Harness/Pipeline (paridade core)

> Este é o coração da paridade com LionClaw. Sem execução com tela de acompanhamento/interação ao vivo, o produto não atinge MVP. Domínios: backend (worker + use-cases) e frontend.

#### 1.1 — Cadastro de path do projeto (Project registration)
- **Problema:** harness (`routes/harness.ts:34`) e pipeline (`routes/pipeline.ts:36`) não recebem `projectPath`; coder roda em `os.tmpdir()/wolfkrow-harness/{id}` (`container.ts:212`). LionClaw coleta `projectPath` inline no NewProjectModal/NewPipelineModal e grava artefatos em `<projectPath>/.lionclaw/...`.
- **Implementação:**
  - Adicionar `projectPath` (caminho absoluto de repo existente) ao contrato Zod de criação de harness e pipeline (`shared-types`), e coluna em `harness_projects` / `pipeline_projects` (migration up/down).
  - Validar path no backend (existe, é diretório, dentro de allowlist configurável; aplicar `ssrf-guard`-like para paths).
  - Thread `projectPath` em `getHarnessProjectWorkDir` e `makeCoderWithTools` (tools bash/filesystem com cwd = projectPath, não tmp).
  - (Opcional/recomendado) Tabela `projects` + tela `/projects` para registrar repositórios reutilizáveis; harness/pipeline selecionam um projeto cadastrado OU informam path inline.
- **Arquivos:** `packages/shared-types`, `packages/infra/src/db/schema/{harness,pipeline}.ts` + migration, `apps/worker/src/container.ts`, `routes/harness.ts`, `routes/pipeline.ts`, frontend create modals.
- **Critério de aceite:** criar harness/pipeline exige path válido; coder edita arquivos no repo informado; artefatos gravados sob o projeto.

#### 1.2 — Backend: endpoints de execução com streaming (SSE)
- **Problema:** não há rota de run/stream. Harness não tem `run`; pipeline `run` é síncrono e devolve JSON completo.
- **Implementação:**
  - **Harness:** rota worker `POST /harness/projects/:id/run` (e proxy web `/api/harness/projects/[id]/run`) retornando SSE com eventos discriminados (Zod): `round-start`, `coder-chunk`, `coder-tool-call`, `coder-tool-result`, `evaluator-chunk`, `round-metrics`, `verdict`, `done`, `error`. Reusar `runHarnessFeature` (`harness/runner.ts`) emitindo eventos por callback `onAgentStream` (padrão LionClaw).
  - **Pipeline:** rota worker `POST /pipeline/projects/:id/phases/:phase/run` em SSE com eventos `phase-start`, `text-chunk`, `tool-call`, `tool-result`, `awaiting-input` (para fases conversacionais), `phase-metrics`, `phase-complete`, `error`. Pause/abort via `POST .../control` (signal).
  - Persistir log de stream (replayable) por round/fase (tabela ou arquivo sob projectPath), para reabrir a tela e ver histórico (LionClaw `getStreamLog`).
  - Implementar o **loop AI automático do harness** (Planner→Coder→Smoke→Evaluator, maxRounds) — o que o FEATURE_MATRIX marcava como v1.1, agora requerido por paridade.
- **Arquivos:** `apps/worker/src/routes/{harness,pipeline}.ts`, `apps/worker/src/harness/runner.ts`, `packages/use-cases/src/{harness,pipeline}/*`, `apps/web/app/api/{harness,pipeline}/...`.
- **Critério de aceite:** `curl` no endpoint SSE emite eventos em tempo real; pause/abort funcionam; reabrir projeto replica histórico; cobertura ≥85%.

#### 1.3 — Frontend: Harness ExecutionView (monitor ao vivo)
- **Problema:** `/harness` é tela plana (form + lista empilhados), sem run, sem monitor. LionClaw usa master/detail com tabs `Sprints | Execução | Métricas` e stream Coder|Evaluator.
- **Implementação (portar do LionClaw `ExecutionView`/`AgentStreamPanel`):**
  - Converter `/harness` em **master/detail**: lista de projetos (com `NewProjectModal`, não form inline) → detalhe com tabs `Sprints | Execução | Métricas`.
  - Botão **Run** por projeto/sprint que abre `ExecutionView`.
  - `ExecutionView`: cabeçalho com `rodada N/max` + timer de elapsed, botões **Pause/Abort**, **duas colunas** (painel Coder | painel Evaluator) consumindo o SSE, chips de tool-call, blocos de thinking, rodapé por painel com tokens/custo/duração, faixa de histórico de rounds.
  - Usar primitivos `ui/` (Card/Badge/Button/Progress), `EmptyState`/`Skeleton`, `react-markdown` para output, botão copiar em code blocks.
- **Arquivos:** `apps/web/components/harness/{harness-view,execution-view,agent-stream-panel,metrics-view,rounds-list}.tsx`, `apps/web/app/(app)/harness/page.tsx`.
- **Critério de aceite:** clicar Run abre tela de acompanhamento ao vivo; streams Coder/Evaluator aparecem; pause/abort refletem no backend; layout consistente com o resto do app.

#### 1.4 — Frontend: Pipeline ActivePipelineView (monitor + interação)
- **Problema:** ao executar, nenhuma tela de acompanhamento/interação abre; saída cai num `<pre>`. LionClaw abre `ActivePipelineView` com stream, chat de fase, progress bar, métricas, pause/retry.
- **Implementação (portar `PipelineProgressBar`, `PipelineStreamView`, `PipelineChatView`, `PipelineMetricsReport`):**
  - Ao executar fase, abrir `ActivePipelineView` (master/detail) substituindo o `<pre>` síncrono.
  - `PipelineProgressBar`: barra de todas as fases, clicável para histórico, com reset de fase/sprint (+ dialog de confirmação).
  - Tabs de view-mode `Chat | Sprints | Métricas`.
  - `PipelineStreamView`: texto streamado com cursor, blocos de tool-call colapsáveis (input/output), banner de transição automática, banner de retry/abort.
  - `PipelineChatView`: **interação do usuário durante fases conversacionais** (evento `awaiting-input` → input do usuário → continua). Reusar máquina do `chat-view`.
  - Estado unificado via enum `uiState` (done/failed/streaming/awaiting-input/paused/idle) para badges/botões nunca conflitarem.
- **Arquivos:** `apps/web/components/pipeline/{pipeline-view,active-pipeline-view,pipeline-stream-view,pipeline-chat-view,pipeline-progress-bar,pipeline-metrics-report}.tsx`, `apps/web/app/(app)/pipeline/...`.
- **Critério de aceite:** executar fase abre monitor ao vivo; fases conversacionais permitem responder; pause/resume/retry funcionam; histórico de fases navegável.

#### 1.5 — Métricas (paridade de visualização)
- **Problema:** dados de métricas existem nos objetos de projeto/round, mas só são mostrados como frase ("totalTokens"). LionClaw tem KPIs, tabelas por fase/sprint, custo por agente, split cloud/local.
- **Implementação (portar `KpiCard`/`BarRow`/tabelas):**
  - `MetricsView` (harness) e `PipelineMetricsReport` (pipeline): KPI row (tokens, custo total com split cloud/local/codex, pass rate, # requests, # tool uses), tabela por fase (custo/duração/tokens/modelo), tabela por sprint (rounds, coder$/eval$, veredito), gráfico por agente.
  - Reusar `recharts` (já usado em `/usage`) + `Table`/`Progress`.
- **Critério de aceite:** abas de métricas exibem custo/duração/tokens por fase, sprint e agente; valores batem com os do backend.

---

### EPIC 2 — Redesign de Layout / Shell

> Domínio frontend. Foco: moderno, minimalista, impactante, foco em UX. Corrigir header/content/footer, polir componentes.

#### 2.1 — Shell: contrato de altura, headers, footer global
- **Problema:** `<main>` sem contrato de altura/overflow; headers duplicados (Topbar + header por view); sem footer/indicador de jobs ativos.
- **Implementação:**
  - `SidebarInset` como `flex flex-col h-svh`; `<main className="flex-1 min-h-0 overflow-hidden">`.
  - Consolidar headers: páginas `flush` (chat/terminal/graph) assumem header próprio e ocultam breadcrumb; demais usam o slot `actions` do Topbar — eliminar a barra dupla.
  - Adicionar **footer/strip global de "execuções ativas"** alimentado por status de harness+pipeline (some quando navega — hoje perde noção de jobs em andamento). Indicador clicável que leva ao monitor (EPIC 1).
- **Critério de aceite:** sem dupla barra de cabeçalho; `<main>` ocupa altura correta em todas as telas; indicador global de runs visível em qualquer rota.

#### 2.2 — Sidebar: ícones, versão, seção de atividade
- **Problema:** `Network` duplicado (MCP+Graph); `FileText` triplicado (Rules+Usage+Logs); ícone do sidebar diverge do da página; versão "v1.0.0" hardcoded; sem seção de recentes/ativos.
- **Implementação:**
  - Atribuir ícones distintos: Graph→`Share2`/`GitBranch`, Rules→`ScrollText` (igual à página), Usage→`BarChart3` (igual à página), Logs→`FileText`.
  - Versão dinâmica (ler de `package.json`/env, não hardcode).
  - Seção colapsável "Recentes / Execuções ativas" (sessões de chat + pipelines/harness ativos com dot de streaming), padrão LionClaw `PipelinesActiveSidebar`.
  - Derivar sidebar **e** command palette de **uma** config de nav (hoje duplicam com agrupamento divergente → risco de drift).
- **Critério de aceite:** nenhum ícone duplicado; versão reflete build; nav e command palette consistentes; atividade visível na rail.

#### 2.3 — Dashboard (nova tela)
- **Problema:** não existe dashboard; Topbar mostra breadcrumb "Dashboard" fantasma. Usuário pediu dashboard + métricas conforme LionClaw.
- **Implementação:** criar `app/(app)/dashboard/page.tsx` (e tornar landing pós-login):
  - **KPI row** (`KpiCard`): uso de tokens hoje/semana, custo total (split cloud/local/codex), # runs ativos, # agents, # skills.
  - **Recent runs**: últimas execuções de harness + pipeline (status badge, fase/sprint, custo, duração) com click-through ao monitor.
  - **Usage sparkline / codeburn** (reaproveitar `usage-charts` + `BudgetBanner` compactos).
  - **Quick actions**: Novo chat, Novo pipeline, Rodar auditoria.
  - **Active monitors**: harness/pipeline rodando com progress bar (link ao EPIC 1).
- **Critério de aceite:** dashboard carrega KPIs reais, runs recentes e monitores ativos; é a tela inicial; breadcrumb deixa de ser fantasma.

---

### EPIC 3 — Funcionalidades de Frontend

#### 3.1 — Chat: seletor de provider/LLM in-chat
- **Problema:** chat usa `model` fixo (`DEFAULT_CHAT_MODEL`), sem picker. LionClaw mostra modelo como badge read-only (seleção em Settings). Usuário quer **picker in-chat** (supera LionClaw).
- **Implementação:**
  - `Select`/`DropdownMenu` compacto no `ChatHeader` (e/ou pill na borda do input) listando providers+models de `/api/providers` (agrupar por provider).
  - Elevar `model` para estado do `ChatView` (seed do `DEFAULT_CHAT_MODEL` ou último modelo da sessão), persistir por sessão; `useChatStream` já envia `model`.
  - Manter modelo atual sempre visível (preserva UX de badge quando colapsado).
- **Arquivos:** `apps/web/components/chat/{chat-view,chat-header,chat-hooks}.tsx`.
- **Critério de aceite:** trocar provider/modelo no chat afeta a próxima mensagem; seleção persiste na sessão; modelos vêm dos providers cadastrados.

#### 3.2 — Editor de Markdown + frontmatter (agents/skills/rules)
- **Problema:** sem editor markdown real; preview de skill é falso (não renderiza); sem frontmatter. LionClaw tem `MarkdownEditor` + `SkillEditor`.
- **Implementação:**
  - Componente compartilhado `MarkdownEditor` (textarea + preview `react-markdown` ao vivo — já bundlado no chat). Corrigir aba "Preview" de skills para renderizar markdown de verdade.
  - **Frontmatter:** editor estruturado (form key/value via `gray-matter`) acima do corpo markdown, para `name/description/model/tools/tags`, com parse/serialize. Unifica form de agent + prompt e dá editor próprio a skills/rules.
  - Considerar superfície única de "file editor" para `.claude/agents/*.md`, `skills/*.md`, `rules/*.md` (framework é file-based).
- **Arquivos:** `apps/web/components/common/markdown-editor.tsx` (novo), `components/skills/skill-editor.tsx`, `components/agents/agent-form-body.tsx`, `components/rules/rules-editor.tsx`.
- **Critério de aceite:** preview renderiza markdown; frontmatter editável e válido; agents/skills/rules editáveis como arquivos .md.

#### 3.3 — Agent edit: reset de modelo ao trocar provider
- **Problema:** troca dinâmica funciona (`model-section.tsx` driven por `/api/providers`), mas modelo antigo permanece ao trocar provider (pode submeter modelo inválido).
- **Implementação:** em `ModelField`, ao mudar provider, setar `model` para o primeiro modelo do novo provider quando o atual não pertence à lista nova (`setValue('model', providerCfg.models[0])`).
- **Critério de aceite:** trocar provider repopula e reseta o modelo; nunca submete modelo de outro provider.

#### 3.4 — Polish geral de componentes
- **Implementação (prioridade UX):**
  - Substituir `<button>` crus de harness/pipeline pelo primitivo `Button`.
  - Adotar `EmptyState`/`ErrorState`/`Skeleton` (já existem) onde hoje há texto cru.
  - Modal-izar criação de projeto harness/pipeline (em vez de form inline no topo).
  - Extrair **um** mapa compartilhado de cores/variantes de status (`Badge`) — hoje redefinido por arquivo.
  - Code blocks com botão copiar; espaçamentos consistentes; respeitar tokens oklch.
- **Critério de aceite:** zero `<button>` cru; estados vazio/carregando/erro padronizados; status badges unificados.

---

### EPIC 4 — Configs e Integrações

#### 4.1 — Channel config (Slack/Discord/WhatsApp)
- **Problema:** só Telegram. Seed de DB `seedChannels` cria placeholders telegram/discord/slack/whatsapp (`enabled:false`) mas sem UI/bridge e o seed não roda.
- **Implementação:**
  - Curto prazo (paridade LionClaw): expor Slack/Discord/WhatsApp como entradas "Em breve" data-driven pelas linhas `channels` seedadas (EPIC 0.3) — igual ao LionClaw que mostra "Em breve".
  - Médio prazo (melhoria): implementar bridges + componentes de config para os canais priorizados.
- **Arquivos:** `apps/web/app/(app)/channels/page.tsx`, `components/channels/*`, `apps/worker/src/routes/*`.
- **Critério de aceite:** página de canais lista todos com status real; Telegram funcional; demais como "Em breve" (ou implementados, se priorizado).

#### 4.2 — Open Design Studio: tornar funcional + integrar
- **Problema:** `apps/sidecar/src/app/studio/page.tsx` é placeholder; sem `packages/design-tools`; sem integração com pipeline/harness (LionClaw tem fase design + design lock no development-v2).
- **Implementação:**
  - Implementar `apps/sidecar/studio` real (integrar/portar o estúdio de design — `packages/design-tools`), gerando artefatos (HTML interativo + contrato JSON + brief markdown), como LionClaw `vendor/open-design`.
  - Adicionar **fase de design + design-lock** à máquina de estados do pipeline (variante development-v2): fase conversacional de design → lock que grava manifest/contract/artifact/brief sob `<projectPath>/docs/.../design/`.
  - Web já tem wrapper (`components/sidecar/design-studio.tsx` + `/api/sidecar` start/stop/status + iframe) — conectar ao estúdio real.
- **Arquivos:** `apps/sidecar/src/app/studio/*`, `packages/design-tools` (novo/portar), `packages/use-cases/src/pipeline/*` (fase design), `apps/worker/src/routes/{sidecar,pipeline}.ts`.
- **Critério de aceite:** abrir Design Studio mostra estúdio funcional (não placeholder); pipeline development-v2 tem fase de design + lock gravando artefatos no projeto.

#### 4.3 — Validação do SDK glm/kimi/minimax/qwen (sem mudança, só guarda)
- **Status:** **funciona** — `ClaudeCompatProvider` (`claude-compat.ts:62`) sobrescreve baseURL+apiKey; modelo por request; baseURLs anthropic-compat corretos (zai/minimax/moonshot/qwen) em `provider-registry.ts:151-186`; worker resolve provider por agent/modelo (`container.ts:184`).
- **Ação:** adicionar testes de integração que asseguram, por provider, que a request sai com `ANTHROPIC_BASE_URL`/auth/model corretos (regressão). Sem mudança de código.
- **Critério de aceite:** teste por provider confirma override end-to-end.

---

### EPIC 5 — Auditoria Rigorosa Final / Validação (gate de MVP)

> Esta seção é o **gate de qualidade**. Nada é "done" sem passar aqui. Executar via subagents de QA por domínio (regra `qa-verdict`) e e2e Playwright.

#### 5.1 — Matriz de validação por checklist do usuário

Para **cada feature** (Chat, Agents, Skills, MCP, Knowledge, Graph, Tasks, Scheduler, Harness, Pipeline, Audit, Design, Terminal, Enrich, Profiler, Memory, Rules, Vault, Channels, Permissions, Usage, Settings, Logs, Voice, Auth, Dashboard), validar TODOS os critérios abaixo e registrar PASS/FAIL com evidência:

| # | Critério | Como validar |
|---|---|---|
| 1 | Item realmente implementado | Existe rota + componente + use-case wired |
| 2 | Funcional | Smoke manual + e2e do fluxo principal |
| 3 | Segue a definição do plano/spec | Conferir contra SPEC-xxx + este plano |
| 4 | Clean Code | Lint 0; arquivos ≤300 linhas, funções ≤50 |
| 5 | Clean Arch | Dependências domínio→use-case→infra→presentation; sem lógica em rota/componente |
| 6 | SOLID | Revisão por `spec-qa-*`; sem god-objects |
| 7 | DRY | Sem duplicação (status maps, nav config, etc.) |
| 8 | YAGNI | Sem código morto / feature não usada (ver `workflow` index-only) |
| 9 | Sem bugs | QA bug-detection por domínio; e2e verdes |
| 10 | Sem débito técnico bloqueante | Backlog de WARNING aceito; nenhum BLOCKER/CRITICAL/MAJOR aberto |
| 11 | Testes unitários sem falhas | `pnpm test` verde; CI verde |
| 12 | Teste valida o código (não só mock) | Revisão de testes: comportamento real, não mock-only |
| 13 | Cobertura | backend ≥85%, frontend ≥70% (≥80% auth) |
| 14 | Integração BE↔FE correta | Contrato Zod casa request/response; sem drift entre `/api/*` e worker |
| 15 | Layout moderno/minimalista/usável | Revisão UX (EPIC 2/3) |
| 16 | Componentes padronizados | Só primitivos `ui/`; tokens oklch |
| 17 | Frontend reflete todas as funcionalidades | Toda feature do backend tem entrada de UI; nenhum orphan funcional |
| 18 | Layout bem distribuído | Shell (EPIC 2.1) aprovado |
| 19 | Boas práticas UI/UX | a11y (labels, foco, contraste), responsivo |
| 20 | Sem ambiguidade | Empty/error/loading states claros; sem "Run" sem ação |

#### 5.2 — Suítes de teste obrigatórias
- **Unit (Vitest):** todo use-case novo (run harness/pipeline SSE, seeds, providers upsert, multi-user shared), todo componente novo (execution-view, pipeline stream, dashboard, markdown editor, chat picker).
- **Integração:** seeds rodam no boot; provider edit não duplica; SDK override por provider; auth login + 30d; multi-user shared access.
- **E2E (Playwright):** login→chat; criar+rodar harness com monitor ao vivo; criar+rodar pipeline com interação; trocar provider no chat; editar provider/agent; dashboard carrega; seeds presentes.
- **Visual regression:** shell, sidebar, dashboard, harness/pipeline monitor.

#### 5.3 — Auditoria de regressão e consistência
- Rodar `wolfkrow-audit` (4 auditores: security/performance/quality/scope) sobre o codebase pós-implementação; gerar backlog automático.
- Verificar **drift entre as duas superfícies de API** (web `/api/*` use-cases diretos vs worker Fastify) — garantir lógica única (use-cases compartilhados), sem regra divergente.
- Confirmar que nenhum descope intencional (ADR-0031/0032/0033) foi reintroduzido por engano.
- Confirmar que `workflow` (index-only, ADR-0027) permanece deferido **ou** é removido por YAGNI se não entrar no MVP — decisão explícita, não código morto.

#### 5.4 — Critério de "MVP done"
- Todos os itens A–D da §0 resolvidos ou explicitamente aceitos como descope documentado.
- Matriz 5.1 com 100% PASS nos critérios 1–14 e 17; críticos de UX (15,16,18,19,20) aprovados em review.
- `pnpm lint` 0, `pnpm test` verde, cobertura nos thresholds, e2e verdes, `wolfkrow-audit` sem BLOCKER/CRITICAL/MAJOR aberto.
- Smoke manual: app loga (30d), todas as 26 telas abrem, harness e pipeline executam com monitor/interação ao vivo apontando para um repo real, seeds presentes, provider/agent edit corretos, dashboard com métricas.

---

## 3. Ordem de Execução Recomendada

1. **EPIC 0** (bugs) — desbloqueia uso básico (login, seeds, providers, multi-user).
2. **EPIC 1** (harness/pipeline execução + monitor + projectPath) — paridade central.
3. **EPIC 2** (shell + sidebar + dashboard) — base de layout para o resto.
4. **EPIC 3** (chat picker, markdown editor, polish) — features de frontend.
5. **EPIC 4** (channels, open design, validação SDK) — integrações.
6. **EPIC 5** (auditoria rigorosa) — gate contínuo; rodar parcial ao fim de cada epic e completo no final.

## 4. Riscos e Notas

- **Loop AI automático do harness** era marcado v1.1 no FEATURE_MATRIX; entra no MVP por exigência de paridade — é o item de maior esforço/risco (EPIC 1.2). Mitigar com `maxRounds` guard e testes.
- **Multi-user shared access (0.5)** é decisão de arquitetura que toca ~todos os repos — validar que não quebra auth/audit pessoal.
- **Open Design Studio (4.2)** depende de portar `packages/design-tools`; se o esforço for alto, priorizar estúdio funcional standalone antes da integração no pipeline.
- **Drift de duas APIs**: garantir use-cases compartilhados entre web e worker para não duplicar regra de negócio.
- Atualizar ADR-0017/SPEC-001 (token 30d) e FEATURE_MATRIX (status reais de skills/rules/harness/design) para reencaixar documentação com a realidade pós-MVP.
