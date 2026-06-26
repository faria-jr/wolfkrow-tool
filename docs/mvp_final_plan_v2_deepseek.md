# MVP FINAL PLAN v2 — Wolfkrow Tool
## Auditor: DeepSeek V4 Pro | Data: 2026-06-26 | Base: Lionclaw v3.0.0 → Wolfkrow Next.js 15

---

## OBJETIVO

Garantir que o Wolfkrow Tool MVP contenha **todas as funcionalidades do Lionclaw v3.0.0**, com:
- Arquitetura refatorada para Next.js 15 + Fastify Worker
- Layout moderno, minimalista, impactante e com excelente usabilidade
- Código limpo seguindo Clean Architecture, SOLID, DRY, YAGNI
- Sem bugs, sem débito técnico
- Testes unitários funcionais e válidos
- Frontend padronizado com componentes consistentes

---

## FASE 1: CORREÇÃO DE BUGS CRÍTICOS (BLOQUEADORES)

### 1.1 BUG-001: FOREIGN KEY no Chat sem Agent

**Severidade:** CRÍTICO (bloqueia chat sem agente)  
**Arquivos afetados:**
- `packages/infra/src/db/schema/chat.ts:17-20`
- `packages/infra/src/repos/chat-repos.ts:26`
- `packages/domain/src/entities/chat-session.ts:8,17`
- `packages/use-cases/src/chat/send-message.ts:63`

**Implementação:**

1. **Alterar schema do banco** (`packages/infra/src/db/schema/chat.ts`):
   - Remover `.notNull()` da coluna `agentId`:
   ```typescript
   // ANTES:
   agentId: text('agent_id').notNull().references(() => agents.id, { onDelete: 'restrict' }),
   // DEPOIS:
   agentId: text('agent_id').references(() => agents.id, { onDelete: 'set null' }),
   ```

2. **Alterar repository** (`packages/infra/src/repos/chat-repos.ts`):
   - Linha 26: trocar `session.agentId ?? ''` por `session.agentId ?? null`

3. **Gerar migration**:
   ```bash
   pnpm --filter @wolfkrow/infra db:generate
   ```
   Nome sugerido: `make_agent_id_nullable`

4. **Testes**:
   - Criar sessão sem agentId → deve salvar com `agent_id = NULL`
   - Criar sessão com agentId → deve salvar com FK válida
   - Deletar agent → sessões associadas devem ter `agent_id = NULL` (SET NULL)
   - Enviar mensagem em sessão sem agent → não deve lançar FK error

---

### 1.2 BUG-002: Auto-Lock Dispara em 5 Minutos

**Severidade:** CRÍTICO (usuário desconectado a cada 5 min de inatividade)  
**Arquivos afetados:** `apps/web/hooks/use-auto-lock.ts`

**Implementação:**

1. **Alterar `use-auto-lock.ts`**:
   - Remover completamente o handler de `visibilitychange` (linhas 31-34)
   - Alterar `IDLE_MS` para `30 * 24 * 60 * 60 * 1000` (30 dias)
   - Opcionalmente, implementar verificação periódica da claim `exp` do JWT:
     ```typescript
     const CHECK_INTERVAL = 60 * 60 * 1000; // 1 hora

     useEffect(() => {
       const checkToken = () => {
         const exp = getTokenExpiration(); // decodifica JWT, lê exp
         if (exp && Date.now() >= exp * 1000) {
           lock();
         }
       };
       const interval = setInterval(checkToken, CHECK_INTERVAL);
       return () => clearInterval(interval);
     }, [lock]);
     ```

2. **Verificar settings.auto_lock_minutes**:
   - O campo `settings.auto_lock_minutes` (default: 5) existe no schema mas não é usado pelo frontend
   - Remover ou reporpositivar para controlar o idle timeout (se desejado manter idle lock como feature)

3. **Testes**:
   - Token de 30 dias não deve disparar lock antes da expiração
   - Ao expirar token, API retorna 401 → redirect para `/unlock`
   - Trocar de aba NÃO deve disparar lock
   - Verificar que `POST /api/auth/logout` + redirect funciona corretamente no fluxo de unlock

---

## FASE 2: CHAT — FUNCIONALIDADES COMPLETAS

### 2.1 GAP-001: Seleção de Agent por Sessão no Chat

**Prioridade:** P0  
**Arquivos:** `apps/web/components/chat/chat-hooks.ts`, `apps/web/components/chat/chat-view.tsx`, `apps/web/app/(app)/chat/page.tsx`

**Implementação:**

1. **Adicionar seletor de agent no ChatView:**
   - Criar dropdown/combobox que lista agents do usuário (`GET /api/agents`)
   - Exibir nome e runtime (badge) de cada agent
   - Placeholder: "Direct chat (no agent)" para chat sem agente
   - Seleção persistida no estado da sessão atual

2. **Enviar `agentId` no SSE:**
   - `chat-hooks.ts`: adicionar `agentId` ao body do POST `/api/chat/send`
   - `useChatSession` hook: aceitar `agentId` como parâmetro

3. **Worker: associar agent à sessão:**
   - `send-message.ts`: quando `agentId` é fornecido, criar/atualizar sessão com o agent
   - `orchestrator.ts`: usar configurações do agent (runtime, provider, model, allowedTools, skills) na execução

4. **UI:**
   - Seletor de agent no header do chat (ao lado do ModelPicker)
   - Exibir nome do agent ativo na sessão (se selecionado)
   - Botão para remover agent (voltar para chat direto)

**Testes:**
- Selecionar agent → mensagem enviada com agentId → SSE usa config do agent
- Enviar sem agent → `agentId: undefined` → não quebra FK
- Trocar agent na mesma sessão → atualiza `chat_sessions.agent_id`
- Sistema de tools usa `allowedTools` do agent selecionado
- Skills do agent são injetadas no system prompt

---

### 2.2 GAP-002: Seleção Explícita de Provider no Chat

**Prioridade:** P0  
**Arquivos:** `apps/web/components/chat/model-picker.tsx`, `apps/web/components/chat/chat-view.tsx`

**Implementação:**

1. **Refatorar `ModelPicker`:**
   - Manter agrupamento por provider (já implementado)
   - Adicionar seletor de **provider** como primeiro nível (antes do modelo)
   - Ao selecionar provider, filtrar modelos para mostrar apenas os daquele provider
   - Provider options derivados de `GET /api/providers`

2. **Comportamento:**
   - Provider selecionado → modelos filtrados
   - Modelo selecionado → enviado no SSE
   - Provider padrão: Anthropic (se disponível)
   - Se provedor tem `apiKeyAccount` configurado → usar em vez de inferir

3. **Worker:**
   - `orchestrator.ts`: aceitar `provider` explícito no request, com fallback para inferência por modelo

**Testes:**
- Selecionar Anthropic → mostrar modelos Claude
- Selecionar Codex → mostrar modelos GPT
- Selecionar Kimi → mostrar modelos Kimi
- Enviar mensagem com provider explícito → SSE usa provider correto
- Provider sem API key → exibir aviso

---

### 2.3 GAP-003: Slash Commands no Chat

**Prioridade:** P1  
**Arquivos:** `apps/web/components/chat/chat-view.tsx`, `apps/web/components/chat/slash-command-picker.tsx` (NOVO)

**Implementação:**

1. **Criar `SlashCommandPicker`:**
   - Ativar ao digitar `/` no textarea do chat
   - Listar skills disponíveis (user-invocable) + comandos built-in
   - Filtrar conforme digitação
   - Selecionar com Enter/Tab ou clique
   - Completar comando no textarea: `/skill-name argumentHint`

2. **Comandos built-in:**
   - `/help` — lista comandos disponíveis
   - `/new` — nova sessão
   - `/compact` — compactar sessão atual
   - `/memory <query>` — buscar na memória
   - `/clear` — limpar conversa

3. **Skills invocáveis:**
   - Buscar skills com `userInvocable: true` do endpoint `/api/skills`
   - Exibir nome, descrição, argumentHint no picker
   - Ao selecionar, preencher `/skill-name ` no textarea

**Testes:**
- Digitar `/` → picker aparece
- Filtrar skills → lista atualiza
- Selecionar skill → comando preenchido
- Enviar comando → worker interpreta e invoca skill

---

### 2.4 GAP-004: Contador de Tokens em Tempo Real

**Prioridade:** P1  
**Arquivos:** `apps/web/components/chat/chat-view.tsx`, `apps/web/components/chat/token-counter.tsx` (NOVO)

**Implementação:**

1. **Criar `TokenCounter`:**
   - Exibir no footer do chat (abaixo do textarea)
   - Mostrar tokens da sessão atual (total + última mensagem)
   - Formato: `12.3K tokens | $0.045`
   - Atualizar via eventos SSE `usage`

2. **Cálculo de custo:**
   - Usar pricing registry do `packages/infra/src/pricing/`
   - Exibir custo estimado com base no modelo ativo

3. **UI:**
   - Badge sutil no canto inferior direito
   - Tooltip com breakdown: input/output/cache tokens

**Testes:**
- Durante streaming → token count atualiza
- Trocar modelo → custo recalculado
- Sessão longa → acumula tokens corretamente

---

### 2.5 GAP-005: Sessões no Sidebar com Métricas

**Prioridade:** P2  
**Arquivos:** `apps/web/components/chat/chat-sessions.tsx`

**Implementação:**

1. **Enriquecer listagem de sessões:**
   - Exibir token count na linha da sessão
   - Exibir agent name (se houver)
   - Indicador de sessão ativa
   - Timestamp relativo ("2h ago", "yesterday")

2. **Ações por sessão:**
   - Compact (já existe parcialmente)
   - Delete (já existe)
   - Rename (editar título inline)
   - Archive

---

## FASE 3: AGENTS — FORMULÁRIO COMPLETO

### 3.1 GAP-006 a GAP-016: Campos Faltantes no Agent Form

**Prioridade:** P0-P1  
**Arquivos:**
- `apps/web/components/agents/schema.ts`
- `apps/web/components/agents/agent-form-body.tsx`
- `apps/web/components/agents/agent-form-modal.tsx`
- `packages/domain/src/entities/agent.ts`
- `packages/infra/src/db/schema/agents.ts`

**Implementação:**

#### 3.1.1 Adicionar `maxToolRounds` (GAP-006) — P0

1. **Schema Zod** (`schema.ts`):
   ```typescript
   maxToolRounds: z.number().min(1).max(100).optional().default(10),
   ```

2. **Domain entity** (`packages/domain/src/entities/agent.ts`):
   - Adicionar `maxToolRounds` field

3. **DB Schema** (`packages/infra/src/db/schema/agents.ts`):
   - Adicionar coluna `max_tool_rounds INTEGER DEFAULT 10`
   - Gerar migration

4. **UI** (`agent-form-body.tsx`):
   - Adicionar campo `maxToolRounds` na tab "Model" como NumberInput
   - Label: "Max Tool Rounds"
   - Description: "Maximum tool call rounds per turn"

#### 3.1.2 Expor campos ocultos no form (GAP-007, GAP-008, GAP-009, GAP-010)

1. **`mcpServers` (GAP-009) — P1:**
   - Adicionar nova tab "MCP" no `agent-form-body.tsx`
   - Multi-select com MCP servers disponíveis (`GET /api/mcp-servers`)
   - Usar componente de tags/chips (igual allowedTools)

2. **`squad` (GAP-008) — P1:**
   - Adicionar dropdown na tab "Model":
   - Opções: `harness`, `workflow`, `enrich`, `custom`
   - Label: "Squad"
   - Description: "Agent category/group for organization"

3. **`description` (GAP-007) — P1:**
   - Adicionar textarea no topo do form (antes das tabs)
   - Label: "Description"
   - Placeholder: "What does this agent do?"

4. **`isActive` (GAP-010) — P2:**
   - Adicionar Switch/Toggle no topo do form
   - Ou manter apenas na listagem (toggle inline)

#### 3.1.3 Markdown Editor para System Prompt (GAP-011)

1. Substituir `<Textarea rows={3}>` pelo componente `MarkdownEditor` existente em `components/common/markdown-editor.tsx`
2. Configurar com altura mínima de 200px
3. Preview em tempo real do markdown renderizado

#### 3.1.4 Edição em Página Dedicada (GAP-012)

1. **Criar rota:** `/agents/[id]/edit` → `apps/web/app/(app)/agents/[id]/edit/page.tsx`
2. **Nova página:**
   - Header com breadcrumb: Agents > [Agent Name] > Edit
   - Form completo em página cheia (não modal)
   - Tabs laterais ou topo para organizar seções (Model, Tools, MCP, Thinking, Skills)
3. **Criar botão "New agent":** `/agents/new` → mesma página de edição sem ID
4. **Manter modal para quick-edit?** Não — consistência: sempre full page

#### 3.1.5 Troca Dinâmica de Provider/Model (GAP-013)

1. **Ao selecionar runtime no form:**
   - `cloud` → mostrar models Anthropic (claude-*)
   - `codex` → mostrar models OpenAI (gpt-*, o1-*, o3-*)
   - `local` → mostrar models Ollama (llama-*, qwen*, phi-*) + campo baseUrl
   - `claude-compat` → mostrar dropdown de provider compat + models filtrados
   - `external` → mostrar dropdown de provider externo + models + campos de config

2. **Campo provider condicional:**
   - Só aparece quando `runtime = 'claude-compat'` ou `'external'`
   - Carrega providers do tipo correspondente via API

#### 3.1.6 Seed Agents para Usuários Existentes (GAP-016)

1. **Modificar `ensureSeedAgents`** em `apps/worker/src/seed-agents/seeder.ts`:
   - Rodar seed para **todos** os usuários (não apenas os com 0 agents)
   - Usar upsert (não duplicar agents existentes)
   - Identificar agents built-in vs custom (campo `is_built_in` ou `metadata.source`)

2. **Alternativa:** botão "Load Seed Agents" na UI para carregar manualmente

---

## FASE 4: SKILLS — PADRONIZAÇÃO E MELHORIAS

### 4.1 GAP-017 a GAP-020

**Prioridade:** P0-P1  
**Arquivos:**
- `apps/web/app/(app)/skills/page.tsx`
- `apps/web/components/skills/skills-view.tsx`
- `apps/web/components/skills/skill-list.tsx`
- `apps/web/components/skills/skill-editor.tsx`

**Implementação:**

#### 4.1.1 Tabela (DataTable) Igual Agents (GAP-017)

1. Substituir `SkillList` (card grid) por `DataTable`:
   - Colunas: Name, Description, Category, Status (built-in/custom), Actions
   - Ações: Edit (página dedicada), Delete (com confirmação), Toggle active
   - Header com botão "New Skill"
   - Ordenação por nome, data de criação
   - Filtro por built-in/custom

#### 4.1.2 Edição em Página Dedicada (GAP-018)

1. **Criar rotas:**
   - `/skills/new` → página de criação
   - `/skills/[id]/edit` → página de edição

2. **Página de edição:**
   - Form fields: Name, Description, Category (dropdown), Tags (tag input)
   - MarkdownEditor para o conteúdo principal
   - Preview renderizado do markdown
   - Botões: Save, Cancel, Delete

#### 4.1.3 Suporte a YAML Frontmatter (GAP-019)

1. **Adicionar parser de frontmatter:**
   - Usar `gray-matter` para extrair YAML frontmatter do conteúdo
   - Schema Zod para validar frontmatter:
     ```typescript
     const SkillFrontmatterSchema = z.object({
       name: z.string(),
       description: z.string().optional(),
       version: z.string().optional(),
       author: z.string().optional(),
       tags: z.array(z.string()).optional(),
       model: z.string().optional(),
       allowedTools: z.array(z.string()).optional(),
       disableModelInvocation: z.boolean().optional(),
       userInvocable: z.boolean().optional(),
       argumentHint: z.string().optional(),
       context: z.enum(['fork']).optional(),
       agent: z.string().optional(),
     });
     ```

2. **Formulário:**
   - Tab "Content": MarkdownEditor para o corpo
   - Tab "Metadata": campos do frontmatter (description, version, author, tags, etc.)
   - Tab "Behavior": model, allowedTools, disableModelInvocation, userInvocable, argumentHint

3. **Preview:**
   - Renderizar conteúdo com frontmatter + body combinados
   - Mostrar frontmatter como tabela de metadados

#### 4.1.4 Arquivos Auxiliares (GAP-020) — P2

1. Adicionar upload de arquivos auxiliares para skills
2. Campo `hasAuxFiles` na skill
3. Interface de gerenciamento de arquivos na página de edição

---

## FASE 5: RULES — PADRONIZAÇÃO E MELHORIAS

### 5.1 GAP-021 a GAP-024

**Prioridade:** P1  
**Arquivos:**
- `apps/web/app/(app)/rules/page.tsx`
- `apps/web/components/rules/rules-editor.tsx`

**Implementação:**

#### 5.1.1 Tabela (DataTable) Igual Agents (GAP-021)

1. Substituir cards agrupados por DataTable:
   - Colunas: Title, Kind (behavior/soul/user/custom), Status (enabled/disabled), Sort Order, Actions
   - Ações: Edit, Toggle, Delete
   - Header com botão "New Rule"
   - Agrupamento/filtro por kind

#### 5.1.2 Edição em Página Dedicada com Markdown Editor (GAP-022)

1. **Criar rotas:**
   - `/rules/new` → página de criação
   - `/rules/[id]/edit` → página de edição

2. **Página de edição:**
   - Fields: Title, Kind (dropdown), Body (MarkdownEditor), Sort Order (number)
   - Toggle: Enabled/Disabled
   - Preview do texto final que será injetado no prompt
   - Seção: "How this rule will appear in the prompt"

#### 5.1.3 Regras por Agent (GAP-023) — P2

1. Adicionar tabela `agent_rules` (agent_id, rule_id)
2. Interface na página do agent: multi-select de rules para associar
3. Prompt builder: considerar rules globais + rules do agent

---

## FASE 6: MCP — FORMULÁRIO COMPLETO E EXIBIÇÃO

### 6.1 GAP-025 a GAP-029

**Prioridade:** P0-P1  
**Arquivos:**
- `apps/web/app/(app)/mcp-servers/page.tsx`
- `apps/web/components/mcp/mcp-servers-view.tsx`
- `apps/web/components/mcp/mcp-server-list.tsx`
- `apps/web/components/mcp/add-mcp-server-modal.tsx`

**Implementação:**

#### 6.1.1 Tabela (DataTable) Igual Agents (GAP-025)

1. Substituir card grid por DataTable:
   - Colunas: Name, Transport (stdio/sse), Status (active/inactive), Health, Tools Count, Source (built-in/custom), Actions
   - Ações: Edit, Toggle, Health Check, Restart, Delete
   - Header com botão "Add Server"

#### 6.1.2 Edição em Página Dedicada (GAP-026)

1. **Criar rotas:**
   - `/mcp-servers/new` → página de criação
   - `/mcp-servers/[id]/edit` → página de edição

2. **Página de edição completa com todas as seções do form**

#### 6.1.3 Formulário MCP Completo (GAP-027)

1. **Transport type:** Radio/Select: `stdio` | `sse` | `streamable-http`
2. **Para stdio:**
   - Command (text input, ex: `npx -y @modelcontextprotocol/server-filesystem`)
   - Args (tag input, ex: `/path/to/dir`)
   - Environment variables (key-value editor, com vault integration para API keys)
3. **Para SSE/HTTP:**
   - URL (text input)
   - Headers (key-value editor)
4. **Geral:**
   - Name (text input)
   - Description (textarea)
   - Visibility (select: always / on-demand / background)
   - Auto-start (boolean toggle)
   - Health check endpoint/path

#### 6.1.4 Exibição de MCPs (GAP-028) — Investigar Bug

1. Verificar se `built-in-mcps.ts` está sendo seedado corretamente
2. Verificar query no `mcp-server-repo.ts` — filtra por `user_id`?
3. Verificar se MCPs são criados como `isBuiltIn: true` no seed
4. Garantir que built-in MCPs são visíveis para todos os usuários
5. Se necessário, criar seed que insere built-in MCPs na primeira migração

#### 6.1.5 Test Connection (GAP-029) — P2

1. Worker endpoint: `POST /api/mcp-servers/test`
2. Botão "Test" na linha da tabela e no formulário
3. Feedback: spinner → sucesso (tools count) ou erro (mensagem)

---

## FASE 7: PROVIDERS — CORREÇÕES E MELHORIAS

### 7.1 GAP-030 a GAP-033

**Prioridade:** P1  
**Arquivos:**
- `apps/web/components/settings/provider-config/provider-list.tsx`
- `apps/web/components/settings/provider-config/provider-form-modal.tsx`
- `apps/web/components/settings/provider-config/provider-form-helpers.ts`
- `packages/use-cases/src/providers/save-provider.ts`

**Implementação:**

#### 7.1.1 Override Comportamento (GAP-031)

1. **Analisar `resolveProviderId`:**
   - Se `initial.id` existe → edição → mantém ID original (OK)
   - Se `initial.id` não existe → criação → deriva ID do `displayName` slug
   - **BUG potencial:** se `displayName` mudar na edição, `resolveProviderId` mantém `initial.id` (correto pelo código atual, mas verificar)

2. **Garantir upsert correto:**
   - `SaveProviderUseCase` usa `repo.upsert(provider)`
   - Verificar se `upsert` no repo realmente atualiza (não insere duplicado)
   - Adicionar constraint UNIQUE em `provider_id` + `user_id`

#### 7.1.2 Campos ao Editar (GAP-032)

1. Verificar `buildProviderFormValues` em `provider-form-helpers.ts`
2. Confirmar que `initial` contém todos os campos (id, providerId, displayName, protocol, baseUrl, apiKeyAccount, models, supportsTools, pricingUrl)
3. Verificar que `form.reset(buildProviderFormValues(initial))` popula todos os campos
4. Se models são array, garantir que são clonados (`[...initial.models]`)

#### 7.1.3 Test Connection (GAP-030)

1. Worker endpoint: `POST /api/providers/test`
   - Body: `{ protocol, baseUrl, apiKeyAccount }`
   - Busca API key do vault via `apiKeyAccount`
   - Faz request para `GET {baseUrl}/v1/models` (OpenAI-compat) ou equivalente Anthropic
   - Retorna `{ ok: true, models: [...] }` ou `{ ok: false, error: "..." }`

2. Botão "Test Connection" no form e na listagem

#### 7.1.4 OrchestratorSelector (GAP-033)

1. Implementar seletor global de orquestrador em Settings:
   - Qual SDK usar como padrão (Claude Agent, Claude-Compat, Codex, Lion)
   - Provider padrão
   - Model padrão
2. Salvar em `settings` table

---

## FASE 8: PIPELINE — ESCALA COMPLETA

### 8.1 GAP-034 a GAP-041

**Prioridade:** P0  
**Arquivos:**
- `apps/web/components/pipeline/pipeline-view.tsx`
- `apps/web/components/pipeline/pipeline-template-picker.tsx`
- `apps/worker/src/routes/pipeline.ts`
- `packages/use-cases/src/pipeline/`
- `packages/infra/src/seed/pipeline-templates.ts`

**Implementação:**

#### 8.1.1 14-17 Fases por Pipeline Type (GAP-034)

Expandir os 5 estágios atuais para as fases completas do Lionclaw:

**Development Pipeline (14 fases):**
```
discovery → prd_generator → prd_validator → prd_completo →
tech_database → tech_backend → tech_frontend → tech_security →
spec_generation → spec_enricher →
planner → sprint_validator → coder → evaluator
```

**Development-V2 Pipeline (17 fases — com OpenDesign):**
```
discovery → prd_generator → prd_validator → prd_completo →
design_plan → open_design_studio → design_lock →
tech_database → tech_backend → tech_frontend → tech_security →
spec_generation → spec_enricher →
planner → sprint_validator → coder → evaluator
```

**Security Pipeline (11 fases):**
```
repo_profiler → security_audit → deduplicador →
skeptic_security → skeptic_quality →
spec_generation → spec_enricher →
planner → sprint_validator → coder → evaluator
```

**Architecture Review Pipeline (11 fases):**
```
arch_mapping → arch_triage → arch_diagnosis → arch_decision_interview →
spec_generation → spec_validation → spec_enricher →
planner → sprint_validator → coder → evaluator
```

**Feature Pipeline (14 fases):** Igual Development com agents específicos

2. **Implementação no domain:**
   - Nova entity `PipelineTemplate` com `phases: PipelinePhaseDefinition[]`
   - Cada fase: `{ name, type: 'auto'|'conversation'|'loop', agentId, stage }`
   - Templates já existem em `pipeline-templates.ts` — expandir

3. **UI Pipeline Progress Bar:**
   - Renderizar TODAS as fases na barra de progresso
   - Scroll horizontal se necessário
   - Colorir: completed (green), current (blue), upcoming (gray)
   - Tooltip com nome da fase + status

#### 8.1.2 Pipeline Chat por Fase (GAP-035)

1. **Para fases type='conversation':**
   - Abrir chat inline dentro da fase
   - Usuário conversa com o agente da fase
   - SSE streaming das respostas
   - Botão "Approve" para avançar quando satisfeito

2. **Para fases type='auto':**
   - Rodar automaticamente
   - Mostrar streaming do output
   - Sem interação do usuário (apenas visualização)

3. **Para fases type='loop':**
   - Coder/Evaluator loop
   - Mostrar streaming de ambos
   - Métricas por round

#### 8.1.3 Document Preview (GAP-036)

1. Criar componente `DocumentPreview`:
   - Painel lateral que mostra documentos gerados pelas fases
   - Renderizar markdown, código, specs
   - Botão "Open in editor" ou "Download"

#### 8.1.4 Reset de Fases/Sprints (GAP-037)

1. Botão "Reset" por fase: reseta fase atual para `pending`
2. Botão "Reset Sprints": reseta sprints da fase de implementação
3. Preview do que será deletado antes de confirmar

#### 8.1.5 Project Path no Form (GAP-038)

1. Adicionar campo `projectPath` no formulário de criação do pipeline
2. Usar directory picker (input type=text + browse button)
3. Salvar no schema `pipeline_projects.project_path`

#### 8.1.6 Integração OpenDesign (GAP-041)

1. Nas fases `design_plan` e `open_design_studio` do pipeline dev-v2:
   - `design_plan`: agente gera design brief
   - `open_design_studio`: abre iframe do Design Studio com o brief
   - `design_lock`: trava o design e gera snapshot
2. Integrar `apps/worker/src/open-design/manager.ts` no fluxo do pipeline

#### 8.1.7 Layout e Usabilidade (GAP-040)

Redesign do Pipeline View:
- **Header:** breadcrumb + pipeline name + status badge + action buttons
- **Main area (3 colunas):**
  - Coluna 1 (w-64): Project list + create
  - Coluna 2 (flex-1): Pipeline progress + phase cards
  - Coluna 3 (w-80): Chat/Document preview/Phase details (painel contextual)
- **Progress bar:** horizontal, scrollável, com indicadores de fase
- **Phase cards:** expandir para mostrar detalhes, output, ações

---

## FASE 9: HARNESS — TELA DE ACOMPANHAMENTO

### 9.1 GAP-042 a GAP-044

**Prioridade:** P0-P1  
**Arquivos:**
- `apps/web/components/harness/harness-view.tsx`
- `apps/web/components/harness/execution-view.tsx`

**Implementação:**

#### 9.1.1 Tela de Acompanhamento e Interação (GAP-042)

O ExecutionView já existe mas precisa de melhorias:

1. **Abrir automaticamente ao iniciar execução:**
   - Quando usuário clica "Run", expandir o painel de execução com animação
   - Foco automático no streaming

2. **Melhorar UX do streaming:**
   - Coder output e Evaluator output lado a lado (split view)
   - Tool calls com ícones e status (running/completed/error)
   - Indicador de round atual (ex: "Round 2/5")
   - Timer de elapsed time

3. **Controles:**
   - Pause/Resume (se suportado pelo backend)
   - Abort (já existe)
   - Skip feature (pular para próxima)

#### 9.1.2 Auditoria no Fluxo — Path do Projeto (GAP-044)

1. Verificar se `projectPath` é usado corretamente no worker:
   - `harness-engine.ts`: executa comandos no diretório do projeto?
   - Coder usa `projectPath` como working directory para operações de arquivo
2. Adicionar validação: project path deve existir e ser acessível

---

## FASE 10: LAYOUT — REDESIGN E POLIMENTO

### 10.1 Redesign do Layout

**Prioridade:** P0  
**Arquivos:** `apps/web/app/(app)/layout.tsx`, `apps/web/components/common/sidebar.tsx`, `apps/web/components/common/topbar.tsx`

**Implementação:**

#### 10.1.1 Header e Topbar

1. **Topbar refinada:**
   - Breadcrumb funcional com links clicáveis
   - Search global (Cmd+K) com ícone e hint no canto direito
   - Perfil/avatar do usuário (se multi-user) ou indicador de ambiente
   - Status indicator: worker connected/disconnected, MCP count

2. **Header de página padronizado:**
   - Sempre `<PageHeader>` com: ícone, título, descrição, actions slot
   - Consistente em TODAS as páginas

#### 10.1.2 Content Area

1. **Scroll container único:**
   - `#main-content` com `overflow-auto` (já implementado)
   - Consistente em todas as páginas

2. **Padding e espaçamento:**
   - Padronizar `p-6` em todas as páginas (via `PageContent`)
   - Exceções: `/chat`, `/terminal`, `/graph`, `/design` (full-bleed)

#### 10.1.3 Footer/Status Bar (Opcional)

1. **ActiveRunsBar** (já existe): polir visual
   - Mostrar pipeline + harness runs ativos
   - Badge com contagem
   - Expandir para ver detalhes

#### 10.1.4 Sidebar Menu (Revisão)

1. **Verificar todos os itens:**
   - Dashboard → OK
   - Chat → OK
   - Agents → OK
   - Skills → OK
   - MCP Servers → OK
   - Knowledge → OK
   - Graph → OK
   - Tasks → OK
   - Scheduler → OK
   - Harness → OK
   - Pipeline → OK
   - Security Audit → OK
   - Design Studio → OK
   - Terminal → OK
   - Enrich → OK
   - Profiler → OK
   - Memory → OK
   - Rules → OK
   - Vault → OK
   - Channels → OK
   - Permissions → OK
   - Usage → OK
   - Settings → OK
   - Logs → OK

2. **Verificar itens duplicados:** Nenhum encontrado

3. **Verificar telas sem caminho no menu:** Todas as 27 páginas têm entrada no menu

4. **Navegação aninhada:**
   - Settings → Voice, Providers (submenu já existe)

---

## FASE 11: CONFIGS E MELHORIAS

### 11.1 Auth Token — 30 Dias

**Status:** Já implementado (JWT 30d em `packages/infra/src/auth/jwt.ts`)  
**Ação:** Verificar e testar. Bug do auto-lock já tratado em BUG-002.

### 11.2 Bloquear App Apenas Após Expiração do Token

**Status:** Corrigido em BUG-002  
**Ação:** Remover idle lock de 5 min, manter apenas verificação de exp do token.

### 11.3 Providers — Melhorias

**Já tratado na Fase 7 (GAP-030 a GAP-033)**

### 11.4 Agent: Provider e Model Dinâmico

**Já tratado na Fase 3 (GAP-013)**

### 11.5 Channel Configuration

**Prioridade:** P1  
**Arquivos:** `apps/web/app/(app)/channels/page.tsx`, `apps/web/components/channels/`

**Implementação:**

1. **Telegram:** já funcional — polir UI com setup wizard passo a passo
2. **Slack:** implementar OAuth flow + webhook
3. **Discord:** implementar bot token + webhook
4. **WhatsApp:** placeholder (API complexa, priorizar v2)

---

## FASE 12: MÉTRICAS E DASHBOARD

### 12.1 Dashboard com Gráficos

**Prioridade:** P1  
**Arquivos:** `apps/web/app/(app)/dashboard/page.tsx`, `apps/web/components/dashboard/dashboard-view.tsx`

**Implementação:**

1. **Adicionar gráficos (recharts):**
   - **Tokens por dia** (line chart, últimos 30 dias)
   - **Custo por modelo** (pie/donut chart)
   - **Atividade por agente** (bar chart)
   - **Pipeline/Harness runs** (timeline)

2. **Métricas adicionais:**
   - Sessões de chat ativas
   - Skills usadas
   - MCP servers ativos
   - Uptime do worker

3. **Quick actions** (já existem): manter e polir

---

## FASE 13: TESTES E VALIDAÇÃO

### 13.1 Auditoria de Testes Existentes

**Ação:** Rodar todos os testes e verificar:
- Testes passam sem erros?
- Cobertura atende aos thresholds (lines 85%, functions 85%, branches 80%)?
- Testes realmente validam o comportamento (não apenas assertTrue(true))?

```bash
pnpm test
pnpm test:coverage
```

### 13.2 Novos Testes Necessários

| Área | Testes Necessários | Tipo |
|------|-------------------|------|
| Chat FK fix | Criar sessão sem agentId → salva com null | Unit |
| Chat AgentId | Enviar mensagem com agentId → SSE usa agent config | Integration |
| Auto-lock | Token 30d não expira antes do prazo | Unit |
| Auto-lock | Trocar aba não dispara lock | E2E |
| Agent form | Todos os campos existem e são validados | Unit |
| Agent form | Troca de provider filtra modelos | Component |
| Skills table | DataTable renderiza com colunas corretas | Component |
| MCP form | Transport type, URL, env vars aceitos | Unit |
| Pipeline fases | 14-17 fases renderizadas corretamente | Unit |
| Pipeline chat | Fase conversation abre chat inline | Integration |
| OpenDesign | Integração com pipeline dev-v2 | E2E |
| Providers | Test connection endpoint | Unit |
| Dashboard | Gráficos renderizam com dados reais | Component |

---

## FASE 14: AUDITORIA FINAL DE VALIDAÇÃO

### 14.1 Checklist de Validação por Funcionalidade

#### AUTH
- [ ] Login com senha funcional
- [ ] TOTP 2FA configurável (com QR code)
- [ ] TOTP verificação no login
- [ ] JWT expira em 30 dias
- [ ] Lock NÃO dispara em 5 min de idle
- [ ] Lock NÃO dispara ao trocar de aba
- [ ] Lock dispara quando token expira
- [ ] Rate limiting (10 req/min)
- [ ] Brute force protection (failed_attempts, locked_until)
- [ ] Tela de unlock funcional

#### CHAT
- [ ] Enviar mensagem sem agent → NÃO quebra FK
- [ ] Enviar mensagem com agent → usa config do agent
- [ ] Selecionar provider no chat → modelos filtrados
- [ ] Selecionar modelo no chat → SSE usa modelo correto
- [ ] Slash commands (`/`) → picker aparece
- [ ] Skills invocáveis via `/`
- [ ] Token counter atualiza em tempo real
- [ ] Streaming SSE funcional (texto, tool calls, done)
- [ ] Tool calls inline renderizadas
- [ ] Confirmação para tools destrutivas
- [ ] Anexos de imagem/arquivo
- [ ] Markdown rendering (GFM + syntax highlight)
- [ ] Sessões: create, list, delete, compact
- [ ] Voice conversation (STT + TTS)
- [ ] Barge-in (interromper TTS)
- [ ] Cancel/abort streaming

#### AGENTS
- [ ] Criar agent com todos os campos (name, description, systemPrompt, model, effort, thinking, thinkingBudget, maxTurns, maxToolRounds, allowedTools, mcpServers, skills, runtime, provider, squad, isActive)
- [ ] Editar agent em página dedicada com markdown editor
- [ ] Trocar runtime → provider/models filtrados dinamicamente
- [ ] Trocar provider → modelos filtrados dinamicamente
- [ ] Sync agents to orchestrator
- [ ] Duplicate agent
- [ ] Delete agent (com confirmação)
- [ ] Agent list em DataTable com colunas corretas
- [ ] Seed agents carregados para todos os usuários
- [ ] 71 seed agents disponíveis
- [ ] ContextWindowDisplay
- [ ] ApiKeyStatusIndicator

#### SKILLS
- [ ] DataTable com colunas: Name, Description, Category, Status, Actions
- [ ] Criar skill com YAML frontmatter + markdown body
- [ ] Editar skill em página dedicada com markdown editor
- [ ] Frontmatter parseado e validado (Zod)
- [ ] Campos: description, version, author, tags, model, allowedTools, userInvocable, argumentHint
- [ ] Preview do markdown renderizado
- [ ] Delete skill (com confirmação)
- [ ] Built-in skills seedadas

#### RULES
- [ ] DataTable com colunas: Title, Kind, Status, Sort Order, Actions
- [ ] Criar rule com markdown editor
- [ ] Editar rule em página dedicada
- [ ] Preview do prompt composto
- [ ] Toggle enable/disable
- [ ] Delete rule

#### MCP
- [ ] DataTable com colunas: Name, Transport, Status, Health, Tools, Source, Actions
- [ ] Criar MCP com transport type (stdio/sse/http)
- [ ] Campos: name, command, args, url, env vars, headers, visibility
- [ ] Editar MCP em página dedicada
- [ ] MCPs built-in visíveis para todos os usuários
- [ ] Health check funcional
- [ ] Restart funcional
- [ ] Test connection
- [ ] Toggle active/inactive
- [ ] Tool registry populado

#### PROVIDERS
- [ ] Criar provider (anthropic-compat / openai-compatible)
- [ ] Editar provider carrega campos corretamente
- [ ] Override NÃO cria duplicado (upsert correto)
- [ ] Test connection funcional
- [ ] Delete provider
- [ ] Modelos do provider listados corretamente

#### PIPELINE
- [ ] 5 pipeline types disponíveis (development, dev-v2, security, feature, arch-review)
- [ ] Development: 14 fases
- [ ] Dev-V2: 17 fases com OpenDesign
- [ ] Security: 11 fases
- [ ] Architecture Review: 11 fases
- [ ] Feature: 14 fases
- [ ] Progress bar com todas as fases
- [ ] Fase 'conversation': chat inline funcional
- [ ] Fase 'auto': execução automática com streaming
- [ ] Fase 'loop': coder/evaluator loop
- [ ] Aprovar/rejeitar fase
- [ ] Document preview
- [ ] Reset de fase/sprint
- [ ] Métricas por fase (tokens, custo, duração)
- [ ] Project path no formulário
- [ ] Integração OpenDesign no dev-v2
- [ ] Design Studio abre no iframe do pipeline
- [ ] Layout consistente com restante da app

#### HARNESS
- [ ] Criar projeto com spec path + project path
- [ ] Plan sprints (AI planner)
- [ ] Execution view abre automaticamente ao rodar
- [ ] Streaming coder + evaluator lado a lado
- [ ] Tool calls com status
- [ ] Métricas de sprint (tokens, custo, rounds)
- [ ] Abort/Pause/Resume
- [ ] Diff viewer
- [ ] Rounds list

#### CHANNELS
- [ ] Telegram: setup wizard funcional
- [ ] Telegram: start/stop/pair
- [ ] Telegram: mensagens recebidas criam sessões
- [ ] Slack: OAuth flow + webhook (se implementado)
- [ ] Discord: bot token + webhook (se implementado)

#### DASHBOARD
- [ ] KPIs numéricos: tokens, custo, projetos, runs ativos
- [ ] Gráfico: tokens por dia
- [ ] Gráfico: custo por modelo
- [ ] Gráfico: atividade por agente
- [ ] Quick actions
- [ ] Recent runs

#### OPENDESIGN
- [ ] Sidecar inicia/para corretamente
- [ ] Bootstrap pipeline (brief → prompt → design)
- [ ] Studio carrega no iframe
- [ ] Lock/snapshot funcional
- [ ] Integrado ao pipeline dev-v2

#### SDK INTEGRATION
- [ ] Claude SDK (Anthropic) → modelos Claude
- [ ] Claude-Compat GLM → URL Zhipu + API key vault
- [ ] Claude-Compat Kimi → URL Moonshot + API key vault
- [ ] Claude-Compat MiniMax → URL MiniMax + API key vault
- [ ] Claude-Compat Qwen → URL Alibaba + API key vault
- [ ] Codex SDK → modelos GPT
- [ ] Lion SDK → Ollama, LM Studio, OpenAI-compat
- [ ] OpenRouter → todos os modelos
- [ ] Override de URL, API key, models funcional por provider

#### OUTROS
- [ ] Knowledge: upload, ingest, search, delete docs
- [ ] Graph: visualização D3 force layout
- [ ] Scheduler: cron tasks, review queue
- [ ] Enrich: validator→enricher loop
- [ ] Memory: search, summaries, dreaming
- [ ] Logs: live tail com filtros
- [ ] Usage: métricas, budget alerts
- [ ] Vault: secrets CRUD com keytar
- [ ] Permissions: resolver, audit log
- [ ] Tasks: CRUD pessoal
- [ ] Terminal: PTY funcional

### 14.2 Verificação de Código

- [ ] ESLint zero erros
- [ ] TypeScript strict zero erros
- [ ] Prettier formatado
- [ ] Testes unitários passam (vitest)
- [ ] Cobertura ≥ thresholds (85% lines, 85% functions, 80% branches)
- [ ] Playwright E2E passam
- [ ] Build sem erros (`pnpm build`)
- [ ] Electron wrapper builda sem erros
- [ ] Drizzle migrations geradas e aplicadas

### 14.3 Verificação de Padrões

- [ ] Clean Architecture: 4 camadas isoladas
- [ ] SOLID: SRP, OCP, LSP, ISP, DIP
- [ ] DRY: sem duplicação de lógica
- [ ] YAGNI: sem funcionalidades não solicitadas
- [ ] Componentes ≤ 300 linhas (salvo exceções justificadas)
- [ ] Funções ≤ 50 linhas
- [ ] Zod schemas como single source of truth
- [ ] DI container (Inversify) configurado
- [ ] TDD: RED → GREEN → REFACTOR seguido

---

## CRONOGRAMA ESTIMADO

| Fase | Descrição | Estimativa |
|------|-----------|------------|
| Fase 1 | Bugs críticos (FK + Auto-lock) | 2-4 horas |
| Fase 2 | Chat completo (agent, provider, slash, tokens) | 8-12 horas |
| Fase 3 | Agents form completo | 6-8 horas |
| Fase 4 | Skills padronização + frontmatter | 4-6 horas |
| Fase 5 | Rules padronização + markdown | 3-5 horas |
| Fase 6 | MCP form completo + exibição | 4-6 horas |
| Fase 7 | Providers correções | 2-4 horas |
| Fase 8 | Pipeline escala completa (fases + chat + design) | 12-16 horas |
| Fase 9 | Harness tela de acompanhamento | 3-5 horas |
| Fase 10 | Layout redesign e polimento | 6-8 horas |
| Fase 11 | Configs e channels | 4-6 horas |
| Fase 12 | Dashboard com gráficos | 3-5 horas |
| Fase 13 | Testes | 8-12 horas |
| Fase 14 | Auditoria final | 4-6 horas |
| **TOTAL** | | **69-99 horas** |

---

## NOTAS IMPORTANTES

1. **Multi-usuário:** O sistema atualmente filtra por `user_id`. Para MVP single-user, todos os recursos devem ser acessíveis sem filtro por usuário. Verificar queries que usam `WHERE user_id = ?` e garantir que não bloqueiam acesso.

2. **Sem limitação de funcionalidade:** Confirmar que nenhum cadastro/funcionalidade é limitado por usuário, plano ou role.

3. **Electron Wrapper:** Manter compatibilidade com o wrapper Electron. Nenhuma mudança deve quebrar a build do Electron.

4. **PWA:** Garantir que Service Worker continua funcional após mudanças.

5. **Ambiente de dev:** `pnpm dev` deve iniciar web + worker + sidecar sem erros.
