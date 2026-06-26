# Wolfkrow Tool — MVP Final Plan v2 (Kimi Audit)

> **Objetivo:** transformar o Wolfkrow Tool em uma plataforma 100% funcional, polida e equivalente (ou superior) ao LionClaw v3.0, refatorada para Next.js 15, com layout moderno, minimalista e impactante, zero bloqueios por usuário e sem débito técnico crítico.
>
> **Base da auditoria:** LionClaw v1.0 (`/Users/juniorfaria/projects/lionclawv1.0`), specs `docs/specs/`, ADRs `docs/adr/`, `ARCHITECTURE.md`, `FEATURE_MATRIX.md`, `MIGRATION_FROM_LIONCLAW.md`, `PRD.md` e código real dos apps `web`, `worker`, `wrapper` e packages.
>
> **Data do plano:** 2026-06-26

---

## 1. Resumo Executivo da Auditoria

### 1.1 Estado Geral

O Wolfkrow Tool possui uma **base técnica sólida**: arquitetura em camadas, 1.083 testes unitários passando (581 no worker, 502 no web), lint e typecheck verdes (1 warning), 15 MCPs built-in com binários reais, chat streaming, voice, harness/pipeline, knowledge RAG, vault, scheduler, Telegram bridge e Electron wrapper.

Entretanto, **o projeto ainda não atinge o critério de MVP final** definido pelo Product Owner. Existem bugs reais de integração, gaps de funcionalidade em relação ao LionClaw, inconsistências de UI/UX, débito técnico arquitetural e documentação desatualizada.

### 1.2 Veredito do Checklist de Qualidade

| Critério | Status | Notas |
|---|---|---|
| Item realmente implementado | ⚠️ Parcial | Muitas funcionalidades existem em código mas não são expostas corretamente (ex: MCPs built-in, settings de voz no DB). |
| Item implementado de forma funcional | ⚠️ Parcial | Chat quebra com FK quando não há agente; pipeline não cadastra path de projeto. |
| Segue a definição do plano | ⚠️ Parcial | Server Actions, TanStack Query extensivo e Zustand segregado estão previstos mas não adotados. |
| Clean code | ❌ Não | God components, duplicação massiva Harness↔Pipeline, fetch cru repetido. |
| Clean architecture | ⚠️ Parcial | Camadas existem, mas DI manual, rotas monolíticas e schema morto (`workflow_runs`) ferem a arquitetura. |
| SOLID | ❌ Não | SRP violado em views e rotas; DIP violado com `fetch`/URLs hardcoded. |
| DRY | ❌ Não | Login/unlock/onboarding duplicam wrapper; Harness e Pipeline são clones. |
| YAGNI | ❌ Não | Colunas `settings.orchestrator/voice/stt/compaction` no schema sem migration/use-case; `workflow_runs` órfão. |
| Sem bugs | ❌ Não | FOREIGN KEY no chat, MCPs vazios sem seed, provider override cria novo registro. |
| Sem débito técnico | ❌ Não | DEBT #13, #29 no código; ADRs desatualizados; Husky vazio. |
| Testes unitários sem falhas | ✅ Sim | 1.083 passando. |
| Testes realmente validam o código | ⚠️ Parcial | Testes não pegam FK real, race conditions nem providers reais. |
| Segue todos os requisitos do plano | ⚠️ Parcial | Vários critérios do PRD não atendidos (Excalidraw inline, filtros avançados de audit). |
| Segue o padrão de qualidade do projeto | ⚠️ Parcial | Lint/typecheck passam, mas código não segue os padrões documentados. |
| Frontend moderno, minimalista, impactante | ❌ Não | Paleta cinza, hierarquia fraca, emoji como ícone, selects nativos, empty states pobres. |
| Layout e componentes padronizados | ❌ Não | PageHeader ausente em várias telas, scroll inconsistente, botões nativos misturados. |
| Frontend reflete todas as funcionalidades | ⚠️ Parcial | Chat sem syntax highlight, pipeline sem path de projeto, dashboard sem gráficos. |
| Integração backend/frontend funcional e correta | ⚠️ Parcial | Chat ignora a API do Next.js e fala direto com o worker (`localhost:4000`). |
| Layout bem distribuído e otimizado | ⚠️ Parcial | Dois headers empilhados, sidebar plana com 21 itens, grids não responsivos. |
| Melhores práticas de UI/UX | ⚠️ Parcial | Falta confirmação em deleções, breadcrumbs mecânicos, feedback de loading inconsistente. |
| Frontend sem ambiguidade | ❌ Não | `/audit` é security audit, não audit log; `/settings` é hub de cards, não central unificada. |

### 1.3 Bugs Críticos Confirmados

1. **FOREIGN KEY no chat** — `chat_sessions.agent_id` é `NOT NULL` com `ON DELETE RESTRICT`. Quando o usuário envia mensagem sem selecionar agente, `SendMessageUseCase` cria sessão com `agentId: undefined`, o repo converte para `''` e o SQLite estoura `FOREIGN KEY constraint failed`.
2. **MCPs built-in não aparecem** — o worker inicia os processos a partir do catalog em memória, mas a web lista registros do DB. Se `seedDatabase()` não rodou, `mcp_servers` está vazio e a UI fica vazia.
3. **Provider override cria novo registro** — editar um provider customizado gera um novo `provider_configs` em vez de atualizar o existente, devido à chave composta manual `${userId}::${config.id}`.
4. **Provider campos não carregados no formulário de edição** — o modal reabre com `initial` parcial; testes cobrem criação, mas a edição não popula todos os campos corretamente.
5. **Cookie de sessão inseguro em produção** — `secure: false` e `sameSite: 'lax'` hardcoded em `login`/`unlock`; expiração hardcoded em 30 dias sem refresh token.
6. **Drift schema/migration** — `settings` possui colunas `orchestrator`, `voice`, `stt`, `compaction` no schema Drizzle, mas nenhuma migration as cria. Bancos novos quebrarão.

### 1.4 Gaps Principais vs LionClaw

| Área | LionClaw | Wolfkrow Atual | Gap |
|---|---|---|---|
| Chat | Provider + model selector real, syntax highlight, citações | Apenas `model` string, markdown mínimo, sem highlight | Alto |
| Harness | Aba sprints/execution/metrics, streams por agente, diff viewer | Execução inline básica, sem abas, sem diff viewer | Alto |
| Pipeline | 5 tipos de pipeline, Open Design Studio integrado, Design Lock | Apenas pipeline linear básico, sem tipos, sem ODS integrado | Alto |
| Cadastro projeto | Harness e Pipeline pedem `projectPath`/`specPath` | Harness tem; Pipeline não tem | Alto |
| Configurações | Orquestrador, geral, permissões, aparência | Apenas hub de cards; voz salva em localStorage | Alto |
| MCP | Lista real, teste conexão, associar a agentes | Lista vazia sem seed, health check básico | Alto |
| Sidebar | 17 itens, possivelmente grupos colapsáveis | 21 itens planos, sem agrupamento expansível | Médio |
| Métricas | Gráficos de uso, relatórios de pipeline/harness | KPIs básicos, sem gráficos | Médio |
| Markdown editor | Usado em skills, rules, agents | Apenas skills tem editor decente | Médio |
| Canais | Telegram funcional | Só Telegram, outros "Em breve" | Médio |

---

## 2. Diretrizes Estratégicas para o MVP Final

1. **Paridade funcional com LionClaw** é o mínimo. Melhorias são bem-vindas, mas nenhuma funcionalidade do LionClaw pode faltar no MVP.
2. **Layout polido e moderno** — adotar design system consistente, cor de acento identidade, empty states ricos, skeletons, responsividade.
3. **Zero limitação por usuário** — remover `WOLFKROW_SHARED_WORKSPACE` ou documentar; garantir que todos os usuários (single-user por design) acessem todas as funcionalidades.
4. **Sem funcionalidade fantasma** — tudo que está no schema deve ter use-case, repo, rota e UI; senão, remove-se do schema.
5. **Correção antes de feature** — bugs críticos de DB/auth/chat devem ser resolvidos antes de novas telas.
6. **Auditoria contínua** — cada task deve incluir testes que realmente validem integração (DB real, FK, contratos).

---

## 3. Plano de Implementação Detalhado

### Fase 0 — Fundação: Correções Críticas de Bugs e DB

> **Objetivo:** estabilizar o core para que o chat, auth, MCPs e providers funcionem sem erros. Nenhuma feature nova antes desta fase.

#### Task 0.1 — Corrigir FOREIGN KEY de `chat_sessions.agent_id`

**Descrição:**
O schema atual exige `agent_id NOT NULL` com `ON DELETE RESTRICT`. O domínio permite sessões sem agente. Isso gera o erro `SqliteError: FOREIGN KEY constraint failed` quando o usuário envia uma mensagem sem selecionar agente.

**Implementação:**
1. Alterar `packages/infra/src/db/schema/chat.ts` para tornar `agent_id` nullable:
   ```ts
   agentId: text('agent_id').references(() => agents.id, { onDelete: 'set null' }),
   ```
2. Criar migration Drizzle que altera a coluna (`ALTER TABLE chat_sessions ALTER COLUMN agent_id DROP NOT NULL`) e atualiza a FK para `ON DELETE SET NULL`.
3. Ajustar `packages/infra/src/repos/chat-repos.ts` para persistir `null` quando `session.agentId` for undefined, em vez de `''`.
4. Ajustar `packages/domain/src/entities/chat-session.ts` se necessário para refletir `agentId?: string`.
5. Garantir que, ao deletar um agente, as sessões fiquem com `agent_id = null` e não quebrem.

**Critérios de aceitação:**
- [ ] Enviar mensagem no chat sem selecionar agente não gera erro.
- [ ] Deletar um agente que possui sessões não falha com FK.
- [ ] Teste de integração real (SQLite com FK enforcement) cobre o fluxo.
- [ ] `pnpm db:migrate` aplica a migration sem erro em banco novo.
- [ ] `pnpm typecheck` e `pnpm lint` passam.

#### Task 0.2 — Garantir seed/upsert de MCPs built-in no banco

**Descrição:**
O worker inicia processos MCP a partir do catalog em memória, mas a web lista apenas registros do DB. Se o DB não foi seedado previamente, a tela de MCPs aparece vazia.

**Implementação:**
1. Em `apps/worker/src/index.ts`, durante o bootstrap, executar `upsertBuiltInMcpServers()` após `seedDatabase()`.
2. A função deve inserir ou atualizar (upsert) os 15 MCPs built-in na tabela `mcp_servers` com os dados do catalog (`BUILT_IN_MCP_SERVERS`).
3. Campos: `name`, `command`, `args`, `env`, `isActive`, `visibility`, `user_id` (owner).
4. Adicionar flag para não desativar MCPs customizados do usuário (somente built-in são gerenciados).

**Critérios de aceitação:**
- [ ] Após `pnpm dev` ou `pnpm start`, a tela `/mcp-servers` exibe os 15 MCPs built-in sem necessidade de migração manual.
- [ ] MCPs customizados do usuário não são sobrescritos.
- [ ] Teste de integração valida que o boot popula `mcp_servers`.
- [ ] Teste unitário do seed cobre o upsert.

#### Task 0.3 — Corrigir edição de providers (override sem criar novo registro)

**Descrição:**
Atualmente, editar um provider customizado cria um novo registro em vez de atualizar o existente, porque a chave primária é composta manualmente `${userId}::${configId}`.

**Implementação:**
1. Refatorar `packages/infra/src/repos/provider-config-repo.ts` para usar chave surrogate (`id` UUID) ou chave composta limpa (`userId`, `providerId`).
2. Implementar `update()` separado de `create()`, identificando pelo `id` real.
3. Ajustar schema `provider_configs` para incluir `updated_at`.
4. Ajustar use-cases (`CreateProviderConfig`, `UpdateProviderConfig`) e rotas (`apps/worker/src/routes/providers.ts`, `apps/web/app/api/providers/*`) para tratar PUT/PATCH.
5. Corrigir `ProviderFormModal` para carregar todos os campos (`baseUrl`, `apiKeyAccount`, `models`, `supportsTools`, `pricingUrl`, `protocol`) no modo edição.

**Critérios de aceitação:**
- [ ] Editar um provider atualiza o registro existente, não cria duplicata.
- [ ] Todos os campos são carregados no formulário de edição.
- [ ] Teste E2E/integração simula criação → edição → listagem e verifica um único registro.
- [ ] Teste unitário do repo valida update.

#### Task 0.4 — Corrigir cookie de autenticação e validade do token

**Descrição:**
O usuário solicitou token de 30 dias e bloqueio apenas após expiração. Atualmente a expiração está hardcoded e o cookie é inseguro para produção.

**Implementação:**
1. Manter expiração do JWT em 30 dias (já está assim), mas tornar configurável via `SESSION_MAX_AGE_DAYS` (default 30).
2. Tornar `secure` dinâmico: `secure: NODE_ENV === 'production'` ou `COOKIE_SECURE=true`.
3. Tornar `sameSite` configurável (default `lax`, permitir `strict`).
4. Criar tabela `auth_sessions` (id, userId, jti, createdAt, expiresAt, revokedAt, ip, userAgent) para permitir invalidação server-side no futuro. Para o MVP, a tabela pode ser criada e populada, mas a invalidação é opcional.
5. Documentar `.env.example` com `SESSION_MAX_AGE_DAYS`, `COOKIE_SECURE`, `COOKIE_SAME_SITE`.
6. Implementar auto-lock baseado em `settings.auto_lock_minutes` (ou default). O auto-lock deve ser disparado por inatividade no cliente e/ou tab hidden, solicitando senha na rota `/unlock`. O token continua válido por 30 dias; o lock é uma camada de UI/cliente.

**Critérios de aceitação:**
- [ ] Cookie `secure` é `true` em produção e `false` em dev por padrão.
- [ ] Token JWT expira em 30 dias (testável via `jose` decode).
- [ ] Lock screen aparece após inatividade configurada, sem invalidar o cookie.
- [ ] `.env.example` atualizado.
- [ ] Tabela `auth_sessions` criada via migration.

#### Task 0.5 — Resolver drift do schema `settings`

**Descrição:**
O schema `settings` define colunas `orchestrator`, `voice`, `stt`, `compaction` (JSON), mas a migration 0000 não as cria. Isso causa drift entre schema e banco.

**Implementação:**
1. Decidir: (A) implementar persistence de settings no DB ou (B) remover as colunas do schema até serem implementadas.
2. **Recomendação (A) para MVP:** implementar persistence real.
   - Criar migration adicionando as colunas JSON.
   - Criar `SettingsRepo`, `GetSettingsUseCase`, `UpdateSettingsUseCase`.
   - Mover voz de `localStorage` para DB (`settings.voice`, `settings.stt`).
   - Salvar orquestrador padrão em `settings.orchestrator`.
3. Se optar por (B), remover colunas do schema e deixar apenas `theme`, `metadata`, `telemetry`, `auto_launch`, `auto_lock_minutes`, `updated_at`.

**Critérios de aceitação:**
- [ ] `pnpm db:generate` não gera migration adicional (schema e migrations sincronizados).
- [ ] Settings de voz persistem no DB e não no localStorage.
- [ ] Teste de integração valida leitura/escrita de settings.

#### Task 0.6 — Adicionar FKs e índices faltantes

**Descrição:**
Muitas relações lógicas não possuem FK e várias tabelas user-scoped não têm índice por `user_id`. Isso compromete integridade e performance.

**Implementação:**
1. Adicionar FKs:
   - `scheduled_tasks.agent_id` → `agents.id`
   - `token_usage.session_id` → `chat_sessions.id`, `agent_id` → `agents.id`
   - `compaction_log.session_id` → `chat_sessions.id`
   - `enrich_sessions.validator_agent_id` / `enricher_agent_id` → `agents.id`
   - `graph_edges.source_node_id` / `target_node_id` → `graph_nodes.id`
   - `pipeline_projects.harness_project_id` → `harness_projects.id`
   - `provider_configs.user_id` → `users.id`
   - `tool_permissions.user_id` → `users.id`, `agent_id` → `agents.id`
2. Adicionar índices por `user_id` em: `channels`, `tasks`, `global_rules`, `secrets_metadata`, `enrich_sessions`, `workflow_runs`, `harness_projects`, `pipeline_projects`, `enrich_messages`.
3. Corrigir `mcp_servers.name` unique para ser por `user_id` (ou remover unique se houver risco multi-usuário futuro).
4. Criar migration consolidada para essas alterações.

**Critérios de aceitação:**
- [ ] `drizzle-kit generate` não reporta diferenças.
- [ ] Todas as tabelas user-scoped possuem índice por `user_id`.
- [ ] Testes de integridade de schema passam.

---

### Fase 1 — Layout e UI/UX: Redesign e Padronização

> **Objetivo:** criar uma experiência visual moderna, minimalista, impactante e alinhada ao LionClaw, com componentes padronizados e usabilidade excelente.

#### Task 1.1 — Criar sistema de layouts reutilizáveis

**Descrição:**
Atualmente as telas têm estruturas diferentes (PageHeader em algumas, título interno em outras, scroll inconsistente). Harness e Pipeline são quase clones.

**Implementação:**
1. Criar `apps/web/components/layouts/`:
   - `master-detail-layout.tsx`: painel esquerdo (lista + formulário) e painel direito (detalhes). Usado por Harness, Pipeline e possivelmente Tasks.
   - `settings-layout.tsx`: tabs verticais para configurações (Providers, Voice, Appearance, etc.).
   - `auth-layout.tsx`: wrapper único para login, unlock e onboarding.
   - `page-shell.tsx` já existe; padronizar uso em todas as páginas.
2. Refatorar `HarnessView` e `PipelineView` para usar `MasterDetailLayout`, eliminando duplicação.
3. Refatorar `login/page.tsx`, `unlock/page.tsx`, `onboarding/page.tsx` para usar `AuthLayout`.
4. Garantir que todas as páginas usem `PageHeader` (ou removê-lo e usar Topbar breadcrumb como único header).

**Critérios de aceitação:**
- [ ] Harness e Pipeline compartilham `MasterDetailLayout`.
- [ ] Login/Unlock/Onboarding compartilham `AuthLayout`.
- [ ] Nenhuma página renderiza seu próprio `h1` fora do `PageHeader`/`Topbar`.
- [ ] Scroll e overflow padronizados em todas as páginas.

#### Task 1.2 — Redesign do sidebar e navegação

**Descrição:**
O sidebar atual é plano, com 21 itens em 4 grupos fixos. Não há agrupamento expansível, e alguns itens podem estar fora do padrão LionClaw.

**Implementação:**
1. Revisar `NAV_GROUPS` em `apps/web/lib/nav.ts` contra o LionClaw:
   - LionClaw tem: Chat, Sub-Agentes, Skills, MCP Servers, Scheduler, Tarefas, Canais, Conhecimento, Memória, Logs, Configurações, Regras, Uso, Permissões, Vault, Harness, Pipeline.
   - Wolfkrow tem: Dashboard, Chat, Agents, Skills, MCP Servers, Knowledge, Graph, Tasks, Scheduler, Harness, Pipeline, Security Audit, Design Studio, Terminal, Enrich, Profiler, Memory, Rules, Vault, Channels, Permissions, Usage, Settings, Logs.
   - **Decisão:** manter itens que agregam valor (Dashboard, Graph, Security Audit, Design Studio, Terminal, Enrich, Profiler), mas agrupar melhor. Remover duplicidade funcional (Settings aponta para hub, mas vários itens do Settings também estão no menu).
2. Tornar grupos colapsáveis no sidebar (usar `Collapsible` do shadcn).
3. Destacar item ativo com peso visual maior.
4. Adicionar tooltips consistentes.
5. Substituir logo genérico "W" por identidade visual Wolfkrow (ou manter "W" polido com ícone SVG).
6. Verificar se há itens duplicados ou telas sem caminho no menu.

**Critérios de aceitação:**
- [ ] Sidebar tem grupos colapsáveis.
- [ ] Todos os itens do menu apontam para rotas existentes.
- [ ] Não há itens duplicados.
- [ ] Item ativo é visualmente destacado.
- [ ] Teste de navegação cobre todos os links.

#### Task 1.3 — Polir identidade visual e componentes

**Descrição:**
A paleta atual é excessivamente cinza, há uso de emoji como ícone e selects nativos em algumas telas.

**Implementação:**
1. Definir cor de acento identidade (ex: âmbar/laranja do login) e aplicar em `primary`, `accent`, botões CTA.
2. Substituir emoji em `DesignStudio` (`🎨`) por ícone Lucide (`Palette`).
3. Substituir letras-iniciais em `ChannelIcon` por ícones específicos (Telegram, Slack, WhatsApp, Discord).
4. Padronizar todos os selects para `shadcn/ui Select` (Rules, Vault, etc.).
5. Melhorar `PageHeader`: reduzir altura, usar tipografia mais leve.
6. Criar empty states ricos com ícone, descrição e CTA.
7. Adicionar skeleton screens padronizados para listas.
8. Revisar responsividade (TasksBoard `grid-cols-4`, Scheduler `max-w-4xl`).

**Critérios de aceitação:**
- [ ] Nenhum emoji usado como ícone de funcionalidade.
- [ ] Todos os selects são shadcn Select.
- [ ] Empty states possuem ícone + descrição + CTA.
- [ ] Layout responsivo em telas pequenas.
- [ ] Paleta visual consistente com cor de acento identidade.

#### Task 1.4 — Melhorar chat: syntax highlight, provider/model selector, markdown

**Descrição:**
O chat é funcional mas polido. Não há syntax highlight, não é possível escolher provider, e o markdown rendering é mínimo.

**Implementação:**
1. Adicionar `react-syntax-highlighter` (ou Prism) para blocos de código em `chat-message.tsx`.
2. Criar `ProviderModelPicker` que permite escolher provider + model dinamicamente, com base nos providers cadastrados (built-in + custom).
3. Mostrar provider + model ativo no cabeçalho do chat.
4. Melhorar estilos de markdown (tabelas, listas, headings, blockquotes, links).
5. Adicionar opção de editar/regenerar mensagens (mínimo: regenerar resposta do assistant).
6. Mover a chamada SSE do chat do worker direto para uma Route Handler do Next.js (`/api/chat/send`), mantendo o worker como origem interna.

**Critérios de aceitação:**
- [ ] Blocos de código renderizam com syntax highlight.
- [ ] Usuário pode selecionar provider e model antes de enviar mensagem.
- [ ] Chat não chama `localhost:4000` diretamente do browser.
- [ ] Markdown renderiza tabelas, listas e headings corretamente.
- [ ] Testes de chat atualizados cobrem provider/model selector.

---

### Fase 2 — Configurações (Settings)

> **Objetivo:** unificar e polir as telas de configurações, seguindo o modelo do LionClaw e adicionando editor markdown onde necessário.

#### Task 2.1 — Redesign da central de configurações

**Descrição:**
A tela `/settings` atual é apenas um hub de cards que redireciona para outras páginas. LionClaw tem abas dentro de Settings.

**Implementação:**
1. Transformar `/settings` em central com navegação vertical/tabs:
   - **Orchestrator** (provider/model padrão)
   - **Providers** (gerenciar LLM providers)
   - **Voice** (STT/TTS)
   - **Appearance** (tema, densidade)
   - **Notifications** (canais)
   - **Security** (TOTP, lock, audit)
   - **System** (logs, backup, sobre)
2. Mover `/settings/providers` e `/settings/voice` para dentro dessa estrutura.
3. Reduzir itens duplicados no sidebar (Settings já agrupa Providers, Voice, etc.).

**Critérios de aceitação:**
- [ ] `/settings` tem navegação interna clara.
- [ ] Configurações de voz persistem no DB (Task 0.5).
- [ ] Layout segue padrão SettingsLayout.

#### Task 2.2 — Polir cadastro/edição de agents com editor markdown

**Descrição:**
A tela de agents tem CRUD funcional, mas a edição abre modal. O usuário solicitou tela nova com editor markdown.

**Implementação:**
1. Criar rota `/agents/[id]/edit` (Server Component ou Client Component) com editor markdown para `systemPrompt`.
2. Adicionar seletor de provider/model dinâmico baseado nos providers cadastrados.
3. Permitir trocar provider e model ao editar agente.
4. Melhorar `AgentFormModal` para novo cadastro (manter modal para criação rápida, mas usar o mesmo editor markdown).
5. Adicionar preview de markdown do system prompt.

**Critérios de aceitação:**
- [ ] Ao clicar em editar, abre tela dedicada com editor markdown.
- [ ] Provider e model são selecionáveis dinamicamente.
- [ ] Preview do system prompt funciona.
- [ ] Testes cobrem criação e edição.

#### Task 2.3 — Refatorar Skills para tabela + editor markdown em tela dedicada

**Descrição:**
Atualmente skills abrem em modal. O usuário solicitou tabela igual a agents, com opção de editar/excluir/adicionar, e editor markdown na edição.

**Implementação:**
1. Criar `SkillList` como tabela/cards com colunas: nome, descrição, tags, ações (editar/excluir).
2. Criar rota `/skills/[id]/edit` com editor markdown (`SkillEditor` já existe).
3. Criar rota `/skills/new` para novo cadastro.
4. Manter `SkillsView` como lista principal.

**Critérios de aceitação:**
- [ ] Tela de skills exibe tabela com ações.
- [ ] Edição abre tela dedicada com editor markdown.
- [ ] Testes cobrem CRUD.

#### Task 2.4 — Refatorar Rules para tabela + editor markdown em tela dedicada

**Descrição:**
Rules atualmente usa textarea nativa e agrupamento por kind. Precisa de editor markdown e tabela.

**Implementação:**
1. Refatorar `RulesEditor` para exibir tabela/cards com colunas: título, kind, status, ações.
2. Criar rota `/rules/[id]/edit` com editor markdown para `body`.
3. Substituir `<select>` nativo por shadcn Select.
4. Adicionar confirmação em deleção.

**Critérios de aceitação:**
- [ ] Rules exibe tabela com ações.
- [ ] Edição usa editor markdown.
- [ ] Nenhum select nativo.
- [ ] Confirmação antes de deletar.

#### Task 2.5 — Corrigir e polir MCP Servers

**Descrição:**
MCPs não aparecem sem seed (Task 0.2). Além disso, a tela precisa de polimento.

**Implementação:**
1. Garantir seed automático (Task 0.2).
2. Melhorar `McpServersView` para exibir tabela/cards com: nome, fonte (built-in/custom/planned), status, health, ações (editar/excluir/restart/health check).
3. Criar rota `/mcp-servers/[id]/edit` para edição dedicada.
4. Polir `AddMcpServerModal`.

**Critérios de aceitação:**
- [ ] 15 MCPs built-in visíveis logo no primeiro boot.
- [ ] Tabela com ações funciona.
- [ ] Edição em tela dedicada.

#### Task 2.6 — Implementar configuração de Channels

**Descrição:**
Channels existe no menu, mas só Telegram funcional. Outros estão "Em breve".

**Implementação:**
1. Persistir configuração do Telegram na tabela `channels` (atualmente o token vem do vault).
2. Melhorar UI de `ChannelsList` com ícones específicos por canal.
3. Para canais não implementados (Slack, Discord, WhatsApp), manter "Em breve" mas com UI informativa e botão de notificação de interesse.
4. Persistir pairings do Telegram no DB (`channel_pairings`) em vez de memória.

**Critérios de aceitação:**
- [ ] Configuração de Telegram salva em `channels`.
- [ ] Pairings persistem após restart do worker.
- [ ] Ícones específicos por canal.

---

### Fase 3 — Harness e Pipeline

> **Objetivo:** atingir paridade funcional com LionClaw: tela de acompanhamento rica, cadastro de path de projeto, integração com Open Design Studio e execução correta dos SDKs.

#### Task 3.1 — Redesign da tela de Harness

**Descrição:**
A tela atual é confusa e não segue o padrão LionClaw (abas sprints/execution/metrics, streams por agente).

**Implementação:**
1. Reestruturar `HarnessView` com abas:
   - **Projects**: lista de projetos + criação.
   - **Sprints**: sprints do projeto selecionado.
   - **Execution**: tela de acompanhamento da execução (streams planner/coder/evaluator).
   - **Metrics**: métricas do projeto (tokens, custo, duração, features passadas).
2. Extrair `ExecutionView` para mostrar streams por agente separadamente.
3. Adicionar diff viewer para rounds (se houver artefatos).
4. Adicionar confirmação em deleção.

**Critérios de aceitação:**
- [ ] Harness tem abas Projects/Sprints/Execution/Metrics.
- [ ] Execução mostra streams por agente.
- [ ] Deleção requer confirmação.
- [ ] Métricas visuais (gráficos simples).

#### Task 3.2 — Redesign da tela de Pipeline

**Descrição:**
Pipeline atual é linear e básico. LionClaw tem múltiplos tipos, Open Design Studio integrado, Design Lock.

**Implementação:**
1. Adicionar campo `projectPath` e `specPath` no cadastro de pipeline (igual Harness).
2. Adicionar tipos de pipeline: `development`, `development-v2`, `feature`, `security`, `architecture-review`.
3. Para `development-v2`, integrar Open Design Studio nas fases (Fase 4 Design Plan, Fase 5 ODS, Fase 6 Design Lock).
4. Melhorar visualização de fases com timeline/progress real.
5. Adicionar relatório final de pipeline (já existe `PipelineReportView`; integrar melhor).

**Critérios de aceitação:**
- [ ] Pipeline cadastra `projectPath` e `specPath`.
- [ ] Tipos de pipeline selecionáveis.
- [ ] Development v2 integra Open Design Studio.
- [ ] Design Lock congela artefatos.

#### Task 3.3 — Corrigir execução dos SDKs (glm, kimi, minimax, qwen)

**Descrição:**
O LionClaw executa esses modelos via `anthropic-compat` com override de URL/apiKey/model. O Wolfkrow tem `ClaudeCompatProvider` e presets, mas é preciso garantir que a execução esteja correta.

**Implementação:**
1. Revisar `packages/infra/src/ai-providers/claude-compat.ts` e `provider-registry.ts`.
2. Garantir que, ao selecionar provider `claude-compat` com modelos `glm-*`, `kimi-*`, `minimax-*`, `qwen-*`, o worker use endpoint Anthropic-compat com override.
3. Validar model catalog contra modelos reais publicados; remover modelos inexistentes.
4. Adicionar testes de integração com mocks HTTP para cada provider.

**Critérios de aceitação:**
- [ ] Seleção de glm/kimi/minimax/qwen dispara requisição para endpoint compatível.
- [ ] apiKey e baseUrl do provider override são usados.
- [ ] Testes cobrem cada provider.

#### Task 3.4 — Integração Open Design Studio com Pipeline/Harness

**Descrição:**
Open Design Studio (`/design`) funciona isoladamente. LionClaw o integra no pipeline development-v2.

**Implementação:**
1. Permitir que o pipeline inicie o sidecar Open Design Studio automaticamente na fase de design.
2. Passar contexto do projeto (nome, descrição, spec) para o sidecar.
3. Ao final do design, salvar artefatos (`artifact.html`, `design-contract.json`, `design-brief.md`) no path do projeto.
4. No Harness, permitir carregar design lock como input.

**Critérios de aceitação:**
- [ ] Pipeline inicia ODS automaticamente.
- [ ] Artefatos são salvos no projeto.
- [ ] Harness pode usar design lock.

---

### Fase 4 — Chat, Voice e Métricas

#### Task 4.1 — Corrigir erro do chat agent e adicionar provider/model selector

**Descrição:**
O erro `FOREIGN KEY constraint failed` ocorre ao usar chat agent. Além disso, não há selector de provider/model no chat.

**Implementação:**
1. Resolver Task 0.1 (FK).
2. Adicionar `ProviderModelPicker` no `ChatView`.
3. Persistir última escolha de provider/model (DB ou cookie).
4. Garantir que `SendMessageUseCase` resolva provider/model corretamente.

**Critérios de aceitação:**
- [ ] Chat sem agente não quebra.
- [ ] Usuário pode escolher provider/model.
- [ ] Escolha persiste entre sessões.

#### Task 4.2 — Adicionar métricas conforme LionClaw

**Descrição:**
Dashboard e Usage são básicos. LionClaw tem gráficos e métricas mais ricas.

**Implementação:**
1. Melhorar `DashboardView` com gráficos de atividade (recharts já é dependência).
2. Adicionar métricas por provider/model em Usage.
3. Exibir métricas de Harness/Pipeline no dashboard.
4. Adicionar export de relatórios.

**Critérios de aceitação:**
- [ ] Dashboard possui gráficos de uso ao longo do tempo.
- [ ] Usage detalha por provider/model.
- [ ] Métricas de harness/pipeline visíveis.

---

### Fase 5 — Documentação, Qualidade e Governança

#### Task 5.1 — Atualizar ADRs desatualizados

**Descrição:**
ADR-0011 (Server Actions), ADR-0017 (JWT HS256), ADR-0002 (19 MCPs), ADR-0028 (embeddings JS O(n)) estão desatualizados.

**Implementação:**
1. Atualizar ADR-0017 para refletir ES256 + keypair keytar + cookie `session` + 30 dias.
2. Criar ADR superseding 0011 caso Server Actions não sejam adotados, ou migrar mutations para Server Actions.
3. Atualizar ADR-0002 para 15 built-in + 3 planned.
4. Atualizar ADR-0028 para refletir uso de sqlite-vec vec0.
5. Corrigir README dos ADRs (ADR-0027 está como proposto, mas é Aceito — VIVO).

**Critérios de aceitação:**
- [ ] Todos os ADRs refletem o código real.
- [ ] README dos ADRs sincronizado.

#### Task 5.2 — Atualizar specs e FEATURE_MATRIX

**Descrição:**
Specs e FEATURE_MATRIX têm inconsistências (embeddings, MCPs, audit log, workflow).

**Implementação:**
1. Atualizar SPEC-004 para Voyage + sqlite-vec.
2. Atualizar SPEC-008 para 15 MCPs.
3. Clarificar SPEC-001 sobre refresh tokens, backup codes, CSRF.
4. Consolidar nomenclatura de Audit (`/audit` = security audit; tool-call audit em `/logs`).
5. Atualizar FEATURE_MATRIX com status real pós-correções.

**Critérios de aceitação:**
- [ ] Specs e FEATURE_MATRIX consistentes com código.

#### Task 5.3 — Ativar Husky e remover configurações duplicadas

**Descrição:**
Hooks Husky estão vazios e há dois arquivos Prettier.

**Implementação:**
1. Configurar `.husky/pre-commit` para `pnpm exec lint-staged`.
2. Configurar `.husky/commit-msg` para `pnpm exec commitlint --edit "$1"`.
3. Remover `.prettierrc.json` duplicado.

**Critérios de aceitação:**
- [ ] Pre-commit roda lint-staged.
- [ ] Apenas um arquivo Prettier.

#### Task 5.4 — Melhorar cobertura de testes de integração

**Descrição:**
Testes unitários passam mas não cobrem integração real (FK, DB, providers HTTP).

**Implementação:**
1. Adicionar testes de integração que rodam SQLite real com FK enforcement.
2. Testar fluxo completo: login → criar agente → enviar mensagem no chat → listar sessões.
3. Testar harness: criar projeto → plan → run com mock de AI provider.
4. Testar pipeline: criar projeto → run phases → approve.
5. Testar seed de MCPs.

**Critérios de aceitação:**
- [ ] Cobertura de testes de integração ≥ 70% dos fluxos críticos.
- [ ] Testes de DB real rodam no CI.

---

## 4. Auditoria Final e Validação (Checklist Rigoroso)

Antes de declarar o MVP final, executar a seguinte auditoria:

### 4.1 Funcional — Fluxos Críticos

| # | Verificação | Como testar |
|---|---|---|
| 1 | Login com senha funciona | POST `/api/auth/login` → cookie `session` setado. |
| 2 | TOTP opcional funciona | Setup, enable, disable, login com TOTP. |
| 3 | Lock screen aparece após inatividade | Aguardar `auto_lock_minutes` → `/unlock` requer senha. |
| 4 | Chat sem agente não quebra | Abrir `/chat`, enviar mensagem → resposta streamed, sem erro FK. |
| 5 | Chat com provider/model selecionado | Escolher glm/kimi/minimax/qwen → requisição vai para endpoint compatível. |
| 6 | Criar/editar/deletar agente | CRUD completo, edição em tela dedicada com markdown. |
| 7 | Criar/editar/deletar skill | Tabela + editor markdown. |
| 8 | Criar/editar/deletar rule | Tabela + editor markdown. |
| 9 | MCPs built-in visíveis | `/mcp-servers` exibe 15 built-in após boot limpo. |
| 10 | Configurar provider customizado | Criar → editar → não duplicar. |
| 11 | Harness criar/plan/run | Criar projeto com `projectPath` e `specPath`, gerar sprints, executar. |
| 12 | Pipeline criar/run/approve | Criar projeto com path, rodar fases, aprovar. |
| 13 | Open Design Studio no pipeline | Development v2 inicia ODS, salva artefatos. |
| 14 | Knowledge ingest/search | Upload PDF, buscar, retornar resultados. |
| 15 | Voice conversation | VAD, STT, TTS funcionam. |
| 16 | Scheduler criar tarefa | Cron task, manual run, review queue. |
| 17 | Telegram pairing | Gerar código, parear, mensagens roteadas. |
| 18 | Vault CRUD | Criar segredo, masked UI, backup/export. |
| 19 | Usage metrics | Gráficos e KPIs visíveis. |
| 20 | Logs/audit | Stream de logs, audit log de tool calls. |

### 4.2 Qualidade de Código

| # | Verificação | Critério |
|---|---|---|
| 1 | `pnpm lint` | Sem erros (warnings permitidos se justificados). |
| 2 | `pnpm typecheck` | Sem erros em nenhum package. |
| 3 | `pnpm test` | 100% dos testes passando. |
| 4 | Testes de integração | Cobrem DB real, FK, providers HTTP, harness, pipeline. |
| 5 | God components | Nenhuma view > 200 linhas sem justificativa. |
| 6 | DRY | Login/unlock/onboarding compartilham layout; harness/pipeline compartilham layout. |
| 7 | SOLID | Views não fazem data fetching; hooks/API client abstraem fetch. |
| 8 | YAGNI | Schema sem use-case é removido ou implementado. |
| 9 | Clean arch | Rotas < 150 linhas; use-cases sem dependências de infra direta. |
| 10 | Documentação | ADRs, specs, FEATURE_MATRIX sincronizados. |

### 4.3 UI/UX

| # | Verificação | Critério |
|---|---|---|
| 1 | Layout moderno/impactante | Paleta com cor de acento, sem emoji, ícones consistentes. |
| 2 | Sidebar | Grupos colapsáveis, item ativo destacado, sem duplicados. |
| 3 | Headers | Padronizado (PageHeader ou Topbar, não ambos). |
| 4 | Empty states | Ícone + descrição + CTA. |
| 5 | Loading | Skeletons padronizados. |
| 6 | Responsividade | Funciona em 1280px, 1024px, 768px, 375px. |
| 7 | Ações destrutivas | Confirmação obrigatória. |
| 8 | Chat | Syntax highlight, markdown rico, provider/model picker. |
| 9 | Configurações | Central unificada com navegação clara. |
| 10 | Sem ambiguidade | `/audit` = security audit; tool-call audit em `/logs` renomeado se necessário. |

### 4.4 Segurança

| # | Verificação | Critério |
|---|---|---|
| 1 | Cookie seguro | `secure=true` em produção, `sameSite` configurável. |
| 2 | TOTP | Segredo criptografado no DB (ou pelo menos não em texto plano). |
| 3 | Rate limit | Login, API protegidos. |
| 4 | IDOR | `findById`/`delete` incluem `userId`. |
| 5 | Path traversal | `projectPath` validado e sandboxed. |
| 6 | Secrets | Nunca expostos em logs/UI. |
| 7 | SQL Injection | Drizzle/params preparados em todas as queries. |

### 4.5 Performance

| # | Verificação | Critério |
|---|---|---|
| 1 | Time to first token | < 500ms em condições normais. |
| 2 | Bundle | Nenhuma página > 200KB JS inicial. |
| 3 | DB queries | Índices por `user_id` e FKs presentes. |
| 4 | Cache | TanStack Query usado para server state; cache configurado. |

---

## 5. Ordem de Execução Recomendada

1. **Fase 0** (Tasks 0.1 a 0.6) — correções críticas; sem isso, o resto é construído sobre areia.
2. **Fase 1** (Tasks 1.1 a 1.4) — redesign visual e arquitetura de layout.
3. **Fase 2** (Tasks 2.1 a 2.6) — configurações polidas.
4. **Fase 3** (Tasks 3.1 a 3.4) — harness/pipeline/opendesign.
5. **Fase 4** (Tasks 4.1 a 4.2) — chat e métricas.
6. **Fase 5** (Tasks 5.1 a 5.4) — documentação, qualidade, testes.
7. **Auditoria Final** (Seção 4) — validar tudo.

---

## 6. Considerações Finais

Este plano prioriza **estabilidade, paridade com LionClaw e polimento visual**. A ordem é intencional: não adianta redesenhar telas se o chat quebra com FOREIGN KEY ou se MCPs não aparecem. As correções de DB e auth vêm primeiro, seguidas de arquitetura de layout, depois funcionalidades específicas e, por fim, documentação e auditoria rigorosa.

Ao final deste plano, o Wolfkrow Tool deve ser considerado um MVP final: funcionalmente equivalente ao LionClaw, com layout moderno, código limpo, testes robustos e documentação sincronizada.
