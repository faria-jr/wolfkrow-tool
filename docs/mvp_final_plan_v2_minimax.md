# MVP Final Plan v2 — Wolfkrow Tool (Next.js Parity with LionClaw)

**Data:** 2026-06-26
**Versão:** 2.0 (mvp_final_plan_v2_minimax)
**Status:** 📋 PLANO DE IMPLEMENTAÇÃO DETALHADO
**Escopo:** Atingir paridade funcional (e melhorias) com LionClaw v1.0, com auditoria rigorosa de validação.

---

## Sumário Executivo

Este plano foi gerado a partir de uma auditoria profunda comparando o **LionClaw v1.0** (Electron + Vite, 20 páginas, 85 componentes) e o **Wolfkrow Tool** (Next.js 15 + Worker, 27 rotas, 22 SPECs, 33 ADRs). O objetivo é:

1. **Corrigir 15 bugs identificados** (3 BLOCKERS + 8 MAJOR + 4 MINOR)
2. **Implementar 8 features LionClaw não portadas** (paridade)
3. **Redesenhar UI/UX** com layout polido, moderno, impactante e minimalista
4. **Eliminar débitos técnicos** rastreados (`// DEBT #XX`)
5. **Atingir 85% de cobertura real** em todos packages (não mascarada)
6. **Adicionar plano de auditoria rigorosa** para validação final

**Premissas:**
- ✅ Não bloquear nenhuma feature por usuário (single-user OK)
- ✅ Auto-lock APENAS após expiração do token (30 dias) — comportamento atual está errado
- ✅ Token de autenticação válido por 30 dias (já implementado corretamente)
- ✅ Layout/componentes devem seguir padrão LionClaw, otimizado para Next.js
- ✅ TDD obrigatório (RED → GREEN → REFACTOR)
- ✅ Clean Architecture preservada (4 camadas)
- ✅ SOLID, DRY, YAGNI rigorosos
- ✅ Zero débito técnico ao final

---

## Índice

1. [Visão Geral do Plano](#1-visão-geral-do-plano)
2. [Fase 0 — Correções Críticas (BLOCKERS)](#2-fase-0--correções-críticas-blockers)
3. [Fase 1 — Correções de Bugs MAJOR](#3-fase-1--correções-de-bugs-major)
4. [Fase 2 — Redesign de Layout e UI/UX](#4-fase-2--redesign-de-layout-e-uiux)
5. [Fase 3 — Polimento dos Cadastros](#5-fase-3--polimento-dos-cadastros)
6. [Fase 4 — Paridade LionClaw — Features Faltantes](#6-fase-4--paridade-lionclaw--features-faltantes)
7. [Fase 5 — Eliminação de Débitos Técnicos](#7-fase-5--eliminação-de-débitos-técnicos)
8. [Fase 6 — Cobertura de Testes Rigorosa](#8-fase-6--cobertura-de-testes-rigorosa)
9. [Fase 7 — Auditoria Final de Validação](#9-fase-7--auditoria-final-de-validação)
10. [Critérios de Aceitação Globais](#10-critérios-de-aceitação-globais)
11. [Plano de Rollback](#11-plano-de-rollback)
12. [Métricas de Sucesso](#12-métricas-de-sucesso)

---

## 1. Visão Geral do Plano

### 1.1 Estrutura de Fases

```
Fase 0 (BLOCKERS)   →  Fase 1 (MAJOR)   →  Fase 2 (UI/UX)   →  Fase 3 (Cadastros)
  2-3 dias              3-4 dias              4-5 dias              3-4 dias
         ↓
Fase 4 (Paridade)   →  Fase 5 (Débito)   →  Fase 6 (Tests)   →  Fase 7 (Audit)
  5-6 dias              2-3 dias              2-3 dias              2-3 dias
```

**Total estimado:** 23-31 dias úteis (~5-6 semanas com 1 dev senior)

### 1.2 Estratégia de Execução

- **Paralelização**: Fases 0, 1 e 5 podem ser executadas em paralelo
- **Validação contínua**: Cada fase termina com `pnpm lint && pnpm typecheck && pnpm test`
- **Code review**: Cada PR deve ser revisado antes de merge
- **Branch strategy**: `feature/fase-X-descrição` → PR → review → main
- **TDD**: RED (teste falhando) → GREEN (mínima impl) → REFACTOR

### 1.3 Dependências entre Fases

```
Fase 0 ──┬──> Fase 1 ──┬──> Fase 2 ──┬──> Fase 3 ──┐
         │             │             │             ├──> Fase 7
         │             │             └──> Fase 4 ──┤
         └──> Fase 5 ──┴──> Fase 6 ─────────────────┘
```

---

## 2. Fase 0 — Correções Críticas (BLOCKERS)

> **Objetivo:** Resolver os 3 bugs que bloqueiam uso funcional.
> **Estimativa:** 2-3 dias.
> **Critério de saída:** Todos os 3 bugs resolvidos com testes.

### 2.1 B1 — FOREIGN KEY constraint failed no chat sem agent

**Severidade:** 🔴 BLOCKER
**Arquivos afetados:**
- `packages/infra/src/db/schema/chat.ts:18-20`
- `packages/infra/src/repos/chat-repos.ts:26,32`
- `packages/infra/src/repos/__tests__/chat-repos.test.ts:62-70`
- `apps/worker/src/routes/chat-sessions.ts:22`

**Problema:**
```typescript
// packages/infra/src/db/schema/chat.ts:18-20
agentId: text('agent_id')
  .notNull()                                                    // ❌ NOT NULL
  .references(() => agents.id, { onDelete: 'restrict' }),       // ❌ FK restritiva
```

```typescript
// packages/infra/src/repos/chat-repos.ts:24-32
async save(session: ChatSession): Promise<ChatSession> {
  const agentId = session.agentId ?? '';   // ❌ string vazia quebra FK
  ...
  .values({ ..., agentId, ... })
}
```

Quando o usuário clica "New Chat" → `ChatSession.create({ agentId: undefined })` → repo salva com `agentId = ''` → FK falha.

**Solução (Opção A — alinhar com domínio):**

1. **Schema (`packages/infra/src/db/schema/chat.ts`):**
   ```typescript
   agentId: text('agent_id')
     .references(() => agents.id, { onDelete: 'set null' }),  // nullable
   ```

2. **Repo (`packages/infra/src/repos/chat-repos.ts:26`):**
   ```typescript
   const agentId = session.agentId ?? null;  // null ao invés de ''
   ...
   .values({ ..., agentId, ... })
   .onConflictDoUpdate({ ..., set: { ..., agentId } })
   ```

3. **Migration nova (`packages/infra/src/db/migrations/000X_chat_agent_nullable.sql`):**
   ```sql
   -- Gerado via pnpm db:generate
   ALTER TABLE chat_sessions ALTER COLUMN agent_id DROP NOT NULL;
   ```

4. **Teste novo em `chat-repos.test.ts`:**
   ```typescript
   it('saves session without agent (null)', async () => {
     const session = ChatSession.create({ userId, agentId: undefined, ... });
     const saved = await repo.save(session);
     expect(saved.agentId).toBeNull();
   });

   it('does not throw FOREIGN KEY on agentId undefined', async () => {
     const session = ChatSession.create({ userId, agentId: undefined, ... });
     await expect(repo.save(session)).resolves.toBeDefined();  // não rejeita
   });
   ```

5. **Validação:** Rodar `pnpm worker:test` + `curl -X POST /api/chat/sessions` deve retornar 201.

**Critérios de aceitação:**
- [ ] Schema aceita `agentId = NULL`
- [ ] Migration aplicada com sucesso
- [ ] Teste novo passa
- [ ] E2E: criar "New Chat" sem agentId não dá erro
- [ ] E2E: enviar mensagem sem agentId funciona

---

### 2.2 B2 + B4 + B5 — Provider CRUD: PUT ausente, override cria novo, edição não carrega

**Severidade:** 🟠 MAJOR (mas bloqueia uso real de providers)
**Arquivos afetados:**
- `apps/web/app/api/providers/[id]/route.ts:14-19` (só DELETE)
- `apps/worker/src/routes/providers.ts:34-50` (só POST upsert)
- `apps/web/components/providers/provider-form-helpers.ts:21-23` (slugify regenera id)
- `apps/web/components/providers/provider-list.tsx:73` (passa `initial` mas useEffect pode não disparar)

**Problema:**
1. Não existe endpoint PUT para editar provider
2. `slugifyProviderId(displayName)` regenera id se displayName muda
3. Edição usa mesmo POST de criar → upsert pode criar novo registro

**Solução completa:**

#### 2.2.1 Adicionar endpoint PUT

**Worker (`apps/worker/src/routes/providers.ts`):**
```typescript
// Novo handler após o POST
server.put<{ Params: { id: string }; Body: ProviderConfig }>(
  '/providers/:id',
  {
    preHandler: [server.authenticate],
    schema: {
      params: z.object({ id: z.string().uuid() }),
      body: UpdateProviderSchema,  // id deve ser imutável
    },
  },
  async (request, reply) => {
    const { id } = request.params;
    const updates = request.body;
    // Garante que id não muda
    if (updates.id && updates.id !== id) {
      return reply.code(400).send({ error: 'id_mismatch' });
    }
    return providerRepo.update(id, updates);
  }
);
```

**Web (`apps/web/app/api/providers/[id]/route.ts`):**
```typescript
// Adicionar PUT handler
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const body = await request.json();
  return workerFetch(`/providers/${params.id}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}
```

#### 2.2.2 Corrigir `provider-form-helpers.ts` para preservar id

```typescript
// Antes
export function resolveProviderId(displayName: string): string {
  return slugifyProviderId(displayName);  // ❌ regenera
}

// Depois
export function resolveProviderId(displayName: string, originalId?: string): string {
  if (originalId) return originalId;  // ✅ preserva id na edição
  return slugifyProviderId(displayName);
}
```

#### 2.2.3 Corrigir `ProviderFormModal` para carregar campos

**`provider-form-modal.tsx` linhas 28-30:**
```typescript
useEffect(() => {
  if (initial) {
    form.reset({
      ...initial,
      models: [...initial.models],
      // ✅ Explicitamente copiar cada campo
      displayName: initial.displayName,
      baseUrl: initial.baseUrl,
      apiKey: initial.apiKey,
      enabled: initial.enabled,
      provider: initial.provider,
    });
  }
}, [initial, form]);
```

#### 2.2.4 Distinguir "Create" vs "Update" no form

```typescript
const isEditing = !!initial?.id;
const onSubmit = async (data) => {
  if (isEditing) {
    await updateProvider({ id: initial.id, ...data });
  } else {
    await createProvider(data);
  }
};
```

**Critérios de aceitação:**
- [ ] `PUT /api/providers/:id` existe e valida
- [ ] Editar provider built-in NÃO cria novo registro
- [ ] Form carrega todos os campos ao editar
- [ ] Botão diz "Update" ao editar, "Create" ao criar
- [ ] Testes: `providers.test.ts` cobre PUT

---

### 2.3 B3 — MCPs não exibem nenhum registro na UI

**Severidade:** 🔴 BLOCKER
**Arquivos afetados:**
- `apps/web/components/mcp-servers/mcp-servers-view.tsx`
- `apps/worker/src/routes/mcp-servers.ts`
- `packages/use-cases/src/mcp/list-mcp-servers.ts`

**Diagnóstico:** Necessário verificar o fluxo:
1. Frontend chama `GET /api/mcp-servers`
2. Web route faz `workerFetch('/mcp-servers')`
3. Worker route retorna lista
4. UI renderiza

**Possíveis causas:**
- Response shape mismatch (worker retorna `{ servers: [...] }` mas UI espera `[]`)
- Erro silencioso em `useQuery` que swallow response
- Repo `McpServerRepo.list()` filtra por `userId` incorretamente (shared workspace mode pode estar retornando null)

**Solução:**

#### 2.3.1 Investigar o response shape

```typescript
// apps/worker/src/routes/mcp-servers.ts:GET
// Verificar o que retorna e se o repo está filtrando corretamente
async list() {
  const servers = await mcpServerRepo.listAll();  // ou listByUser(userId)
  return { servers, count: servers.length };
}
```

#### 2.3.2 Auditar o repo

```typescript
// packages/infra/src/repos/mcp-server-repo.ts
async listAll(): Promise<McpServer[]> {
  // Verificar se WHERE clause filtra por isActive ou visibility
  return this.db.select().from(mcpServers).all();
}

async listByUser(userId: string): Promise<McpServer[]> {
  return this.db.select().from(mcpServers)
    .where(eq(mcpServers.userId, userId))
    .all();
}
```

#### 2.3.3 Auditar a UI

```typescript
// apps/web/components/mcp-servers/mcp-servers-view.tsx
const { data, isLoading, error } = useQuery({
  queryKey: ['mcp-servers'],
  queryFn: () => fetch('/api/mcp-servers').then(r => r.json()),
});

// Verificar:
// - data?.servers ou data (array direto)?
// - error é exibido?
// - isLoading tem skeleton?
```

**Critérios de aceitação:**
- [ ] UI exibe todos os MCPs cadastrados (built-in + custom)
- [ ] Toggle on/off funciona
- [ ] Health check visível
- [ ] Teste E2E: listar, criar, editar, deletar MCP

---

## 3. Fase 1 — Correções de Bugs MAJOR

> **Objetivo:** Resolver os 8 bugs MAJOR restantes.
> **Estimativa:** 3-4 dias.

### 3.1 B6 — Agent edit não permite trocar provider/modelo dinamicamente

**Arquivos afetados:**
- `apps/web/components/agents/model-section.tsx:116-137`
- `apps/web/components/agents/agents-view.tsx`

**Problema:** Quando `runtime !== 'claude-compat'`, o campo `provider` some. Usuário não pode escolher entre providers disponíveis.

**Solução:**

```typescript
// model-section.tsx — sempre mostrar provider, lista derivada do runtime
function ModelSection({ form, runtime }) {
  const { data: providers } = useProviders();

  // Lista de providers disponíveis para o runtime
  const availableProviders = useMemo(() => {
    if (runtime === 'claude-compat') {
      return providers?.filter(p => p.runtime === 'claude-compat') ?? [];
    }
    if (runtime === 'cloud') {
      return [{ id: 'anthropic', displayName: 'Anthropic', models: [...] }];
    }
    // ... outros runtimes
    return [];
  }, [runtime, providers]);

  // Provider select
  <Select
    value={form.watch('provider')}
    onValueChange={(v) => {
      form.setValue('provider', v);
      form.setValue('model', '');  // ✅ reseta model ao trocar provider
    }}
  >
    {availableProviders.map(p => (
      <SelectItem key={p.id} value={p.id}>{p.displayName}</SelectItem>
    ))}
  </Select>

  // Model select (depende do provider selecionado)
  <Select
    value={form.watch('model')}
    disabled={!form.watch('provider')}
  >
    {availableProviders
      .find(p => p.id === form.watch('provider'))
      ?.models.map(m => (
        <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
      ))}
  </Select>
}
```

**Critérios de aceitação:**
- [ ] Provider select sempre visível
- [ ] Model select filtra por provider
- [ ] Trocar provider reseta model
- [ ] Funciona para todos os runtimes (cloud/local/external/codex/claude-compat)

---

### 3.2 B7 — Harness/Pipeline: ao executar não abre tela de acompanhamento

**Arquivos afetados:**
- `apps/web/components/harness/harness-view.tsx`
- `apps/web/components/pipeline/pipeline-view.tsx`

**Problema:** Após clicar "Run" em harness/pipeline, a UI não navega para tela de execução.

**Solução:**

#### 3.2.1 Harness — após criar projeto, navegar para execution view

```typescript
// harness-view.tsx
const handleCreateProject = async (data) => {
  const project = await createProject(data);
  toast.success('Projeto criado');
  // ✅ Navegar para execution view
  router.push(`/harness/${project.id}/execute`);
};
```

#### 3.2.2 Adicionar rota dedicada `/harness/[id]/execute`

```typescript
// apps/web/app/(app)/harness/[id]/execute/page.tsx
export default function HarnessExecutePage({ params }) {
  return <HarnessExecutionView projectId={params.id} />;
}
```

#### 3.2.3 ExecutionView com SSE streaming

```typescript
// Padrão LionClaw: 3 colunas (SprintList | ExecutionStream | Metrics)
<ExecutionView
  projectId={projectId}
  onAbort={abortProject}
  onComplete={handleComplete}
/>
```

#### 3.2.4 Mesma estrutura para Pipeline

```typescript
// Após criar pipeline, navegar para /pipeline/[id]/execute
// Mostrar: ProjectHeader | PhaseProgress | ChatView | StreamView
```

**Critérios de aceitação:**
- [ ] Harness: criar projeto → tela de execução abre
- [ ] Pipeline: criar projeto → tela de execução abre
- [ ] SSE streaming renderiza ao vivo
- [ ] Botão Abort funcional
- [ ] Métricas em tempo real

---

### 3.3 B8 — SSRF bypass via IPs decimal/octal/hex

**Severidade:** 🔴 SECURITY
**Arquivos afetados:**
- `packages/infra/src/config/provider-config.ts:12-15,57-61`

**Problema:** Validação atual só checa prefixo string:
```typescript
if (!url.startsWith('https://')) throw new Error('invalid');
```
Atacante pode usar `https://2130706433` (decimal de 127.0.0.1) ou `https://0x7f000001` (hex).

**Solução:**

```typescript
import { lookup } from 'node:dns/promises';
import { URL } from 'node:url';

async function validateBaseUrl(url: string): Promise<void> {
  const parsed = new URL(url);

  if (!['https:', 'http:'].includes(parsed.protocol)) {
    throw new Error('Invalid protocol');
  }

  const hostname = parsed.hostname;

  // 1. Rejeita IPs literais (exceto se explicitamente allowlist)
  if (/^[\d.]+$/.test(hostname) || /^0x[0-9a-f]+$/i.test(hostname) || /^\d+$/.test(hostname)) {
    throw new Error('IP literal not allowed');
  }

  // 2. Resolve DNS e checa se aponta para IP privado
  const addresses = await lookup(hostname, { all: true });
  for (const { address } of addresses) {
    if (isPrivateIp(address)) {
      throw new Error(`Private IP not allowed: ${address}`);
    }
  }
}

function isPrivateIp(ip: string): boolean {
  // IPv4 private ranges: 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 127.0.0.0/8
  // IPv6 private: fc00::/7, fe80::/10, ::1
  // Use ipaddr.js or similar
  const { parse, isPrivate, isLoopback } = require('ipaddr.js');
  try {
    const addr = parse(ip);
    return isPrivate(addr) || isLoopback(addr);
  } catch {
    return true; // fail-closed
  }
}
```

**Critérios de aceitação:**
- [ ] Teste: `https://127.0.0.1` rejeitado
- [ ] Teste: `https://2130706433` rejeitado
- [ ] Teste: `https://0x7f000001` rejeitado
- [ ] Teste: `https://169.254.169.254` rejeitado (AWS metadata)
- [ ] Teste: `https://api.anthropic.com` aceito

---

### 3.4 B9 — Rules usa `<textarea>` plain, sem MarkdownEditor

**Arquivos afetados:**
- `apps/web/components/rules/rules-editor.tsx:74`

**Solução:** Substituir `<textarea>` por `<MarkdownEditor>` (componente compartilhado já existente).

```typescript
// Antes
<Textarea value={rule.body} onChange={...} rows={10} />

// Depois
<MarkdownEditor
  value={rule.body}
  onChange={(v) => form.setValue('body', v)}
  tabs={['edit', 'preview']}
  height={400}
/>
```

**Critérios de aceitação:**
- [ ] Rules usa MarkdownEditor com tabs (edit/preview)
- [ ] Preview renderiza markdown
- [ ] Compatível com skills (mesmo componente)

---

### 3.5 B10 — App bloqueia após 5min idle (requisito = 30d)

**Arquivos afetados:**
- `apps/web/hooks/useAutoLock.ts`
- `apps/web/app/(app)/layout.tsx`

**Problema:** Auto-lock dispara em 5min de inatividade. Requisito diz: "bloquear o app (solicitar senha) apenas após a expiração do token (30 dias)".

**Solução:**

```typescript
// useAutoLock.ts — comportamento correto
export function useAutoLock() {
  const { session } = useSession();

  // ✅ NÃO bloquear em idle
  // Bloquear APENAS quando token expira (handled by middleware/redirect)

  // Manter verificação de visibilidade apenas para refresh
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        // Refetch session para validar
        refetchSession();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);
}
```

**Critérios de aceitação:**
- [ ] App NÃO bloqueia em idle de 5min
- [ ] App bloqueia APENAS quando token expira (30d)
- [ ] Session refresh funciona em visibility change
- [ ] Token expira → redirect /unlock com senha

---

### 3.6 B11 — Editor markdown ausente em agents/rules

**Arquivos afetados:**
- `apps/web/components/agents/agent-form-modal.tsx` (systemPrompt = textarea)
- `apps/web/components/rules/rules-editor.tsx` (body = textarea)

**Solução:** Para **agents**, abrir nova tela de edição (padrão LionClaw) com editor markdown. Para **rules**, substituir textarea por MarkdownEditor.

#### 3.11.1 Agents — nova tela `/agents/[id]/edit`

```typescript
// apps/web/app/(app)/agents/[id]/edit/page.tsx
export default function AgentEditPage({ params }) {
  return <AgentEditScreen agentId={params.id} />;
}
```

```typescript
// apps/web/components/agents/agent-edit-screen.tsx
// Layout split-pane: form à esquerda, markdown editor à direita
<ResizablePanelGroup>
  <ResizablePanel>
    {/* Form com name, description, runtime, provider, model, tools, skills */}
    <AgentFormFields form={form} />
  </ResizablePanel>
  <ResizableHandle />
  <ResizablePanel>
    {/* Markdown editor para systemPrompt */}
    <MarkdownEditor
      value={form.watch('systemPrompt')}
      onChange={(v) => form.setValue('systemPrompt', v)}
      tabs={['edit', 'preview']}
      height="100%"
    />
  </ResizablePanel>
</ResizablePanelGroup>
```

#### 3.11.2 Rules — MarkdownEditor inline

(ver B9 acima)

**Critérios de aceitação:**
- [ ] Agent edit abre nova tela `/agents/[id]/edit`
- [ ] System prompt usa MarkdownEditor com preview
- [ ] Form com provider/LLM dinâmico
- [ ] Rules body usa MarkdownEditor

---

### 3.7 B14 — Provider registry com 4 fontes divergentes

**Arquivos afetados:**
- `packages/infra/src/config/provider-registry.ts:33`
- `packages/infra/src/config/claude-compat-presets.ts:32`
- `packages/infra/src/pricing/pricing-calculator.ts:64,92`
- `packages/infra/src/orchestrator/orchestrator.ts:52`

**Solução:** Consolidar em uma única fonte `provider-catalog.ts`.

```typescript
// packages/infra/src/config/provider-catalog.ts
export interface ProviderCatalogEntry {
  id: string;
  displayName: string;
  runtime: 'cloud' | 'local' | 'external' | 'codex' | 'claude-compat';
  baseUrl?: string;
  models: ModelCatalogEntry[];
  pricing: PricingTier;
  authType: 'api-key' | 'oauth' | 'none';
  envKey?: string;
  builtIn: boolean;
}

export const PROVIDER_CATALOG: ProviderCatalogEntry[] = [
  {
    id: 'anthropic',
    displayName: 'Anthropic',
    runtime: 'cloud',
    models: [
      { id: 'claude-opus-4', name: 'Claude Opus 4', contextWindow: 200000 },
      // ...
    ],
    pricing: { input: 15, output: 75, /* per 1M tokens */ },
    authType: 'api-key',
    envKey: 'ANTHROPIC_API_KEY',
    builtIn: true,
  },
  {
    id: 'z.ai',
    displayName: 'Z.ai (GLM)',
    runtime: 'claude-compat',
    baseUrl: 'https://api.z.ai/api/anthropic',
    models: [
      { id: 'glm-4.6', name: 'GLM 4.6', contextWindow: 128000 },
    ],
    pricing: { input: 0.6, output: 2.2 },
    authType: 'api-key',
    envKey: 'ZAI_API_KEY',
    builtIn: true,
  },
  // ... minimax, moonshot, qwen, openai, openrouter, ollama, lm-studio
];
```

```typescript
// Remover fontes duplicadas
// - claude-compat-presets.ts → consolidado
// - pricing-calculator.ts → importa PROVIDER_CATALOG
// - provider-registry.ts → importa PROVIDER_CATALOG
// - orchestrator.ts → usa PROVIDER_CATALOG.find(id)
```

**Critérios de aceitação:**
- [ ] Uma única fonte: `provider-catalog.ts`
- [ ] 4 fontes antigas removidas
- [ ] Teste: `getProviderById('z.ai')` funciona
- [ ] Teste: `getPricingForModel('claude-opus-4')` funciona

---

### 3.8 B15 — 20 shadow Zod schemas

**Arquivos afetados:**
- `packages/shared-types/src/schemas/*.ts` (20+ schemas)
- Routes do worker que reescrevem inline

**Solução:** Importar shared-types em TODOS os routes do worker.

```typescript
// apps/worker/src/routes/chat.ts
// Antes
const body = z.object({
  sessionId: z.string().optional(),
  content: z.string().min(1).max(10000),
  // ...
});

// Depois
import { ChatSendBodySchema } from '@wolfkrow/shared-types';
const body = ChatSendBodySchema;  // ✅
```

**Critérios de aceitação:**
- [ ] Todos routes do worker importam shared-types
- [ ] 0 shadow schemas (grep `z\.object\(` em `apps/worker/src/routes/`)
- [ ] Teste: validação funciona com input inválido

---

## 4. Fase 2 — Redesign de Layout e UI/UX

> **Objetivo:** Layout moderno, impactante, minimalista, otimizado para Next.js.
> **Estimativa:** 4-5 dias.

### 4.1 Princípios de Design

- **Moderno + Impactante**: Hero sections, gradientes sutis, micro-interações
- **Minimalista**: Espaço em branco, hierarquia clara, foco no conteúdo
- **Excelente UX**: Padrões consistentes, feedback imediato, acessibilidade WCAG 2.1 AA
- **Padronizado**: Design tokens OKLCH, componentes shadcn, zero hardcode
- **Otimizado Next.js**: RSC por padrão, Suspense boundaries, loading.tsx + error.tsx

### 4.2 Design System (aprimoramento)

#### 4.2.1 Tokens semânticos expandidos

```typescript
// packages/design-tokens/src/tokens.ts
export const tokens = {
  // Spacing scale
  spacing: {
    xs: '0.25rem',   // 4px
    sm: '0.5rem',    // 8px
    md: '1rem',      // 16px
    lg: '1.5rem',    // 24px
    xl: '2rem',      // 32px
    '2xl': '3rem',   // 48px
  },
  // Layout
  layout: {
    sidebarWidth: '16rem',          // 256px
    sidebarCollapsedWidth: '4rem',  // 64px
    topbarHeight: '3.5rem',         // 56px
    contentMaxWidth: '1280px',      // 80rem
  },
  // Radii
  radii: {
    sm: '0.375rem',  // 6px
    md: '0.5rem',    // 8px
    lg: '0.75rem',   // 12px
    xl: '1rem',      // 16px
    '2xl': '1.5rem', // 24px
  },
  // Shadows (semânticas)
  shadow: {
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    md: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
    glow: '0 0 0 1px rgb(var(--primary) / 0.5), 0 0 20px rgb(var(--primary) / 0.2)',
  },
};
```

#### 4.2.2 Componentes compartilhados adicionais

```typescript
// apps/web/components/ui/
// Adicionar:
- page-header.tsx       // Header padrão com breadcrumb + actions
- empty-state.tsx       // Estado vazio com ícone + texto + CTA
- stat-card.tsx         // Card de KPI/métrica (uso em dashboard, metrics)
- data-table.tsx        // Wrapper de TanStack Table com shadcn
- command-bar.tsx       // Cmd+K global (já existe? verificar)
- confirm-dialog.tsx    // Dialog de confirmação destrutiva
- toast-helpers.tsx     // Helpers de toast (success/error/info)
```

### 4.3 Layout Principal — AppShell

**Estrutura:**
```
┌──────────────────────────────────────────────────────┐
│  Topbar (altura 56px, sticky)                        │
│  [Logo] [Breadcrumb] ......... [Cmd+K] [User] [Bell] │
├──────┬───────────────────────────────────────────────┤
│      │                                               │
│ Side │  Content (max-w-7xl, padding responsivo)      │
│ bar  │                                               │
│ 256  │  ┌─────────────────────────────────────────┐  │
│ px   │  │  PageHeader (título + description + btns)│  │
│      │  ├─────────────────────────────────────────┤  │
│ ───  │  │  Loading skeleton OU Content             │  │
│ Main │  │                                         │  │
│ Auto │  │                                         │  │
│ Tools│  │                                         │  │
│ Sys  │  │                                         │  │
│      │  └─────────────────────────────────────────┘  │
│      │                                               │
└──────┴───────────────────────────────────────────────┘
```

**Arquivos:**
- `apps/web/components/layout/app-shell.tsx` (novo)
- `apps/web/components/layout/sidebar.tsx` (refatorar)
- `apps/web/components/layout/topbar.tsx` (refatorar)
- `apps/web/components/layout/page-header.tsx` (novo)

#### 4.3.1 Sidebar redesenhada

**Princípios (do LionClaw):**
- Agrupamento semântico (Main, Automation, Tools, System)
- Drag region macOS
- Badges de notificação
- Colapsável
- Sessões ativas no rodapé (quando em chat)

```typescript
// apps/web/components/layout/sidebar.tsx
<Sidebar collapsible="icon" variant="floating">
  <SidebarHeader>
    <Logo />
    <SidebarTrigger /> {/* mobile */}
  </SidebarHeader>

  <SidebarContent>
    <SidebarGroup title="Main">
      <SidebarItem href="/dashboard" icon={LayoutDashboard}>Dashboard</SidebarItem>
      <SidebarItem href="/chat" icon={MessageSquare}>Chat</SidebarItem>
      <SidebarItem href="/agents" icon={Bot}>Agents</SidebarItem>
      <SidebarItem href="/skills" icon={Zap}>Skills</SidebarItem>
      <SidebarItem href="/mcp-servers" icon={Server}>MCP Servers</SidebarItem>
    </SidebarGroup>

    <SidebarGroup title="Automation">
      <SidebarItem href="/scheduler" icon={Clock}>Scheduler</SidebarItem>
      <SidebarItem href="/harness" icon={Cog}>Harness</SidebarItem>
      <SidebarItem href="/pipeline" icon={GitBranch}>Pipeline</SidebarItem>
      <SidebarItem href="/enrich" icon={Sparkles}>Enrich</SidebarItem>
    </SidebarGroup>

    <SidebarGroup title="Knowledge">
      <SidebarItem href="/knowledge" icon={BookOpen}>Knowledge</SidebarItem>
      <SidebarItem href="/graph" icon={Network}>Graph</SidebarItem>
      <SidebarItem href="/memory" icon={Brain}>Memory</SidebarItem>
    </SidebarGroup>

    <SidebarGroup title="Tools">
      <SidebarItem href="/design" icon={Palette}>Design Studio</SidebarItem>
      <SidebarItem href="/terminal" icon={Terminal}>Terminal</SidebarItem>
      <SidebarItem href="/profiler" icon={Activity}>Profiler</SidebarItem>
      <SidebarItem href="/audit" icon={Shield}>Security Audit</SidebarItem>
    </SidebarGroup>

    <SidebarGroup title="System">
      <SidebarItem href="/rules" icon={FileText}>Rules</SidebarItem>
      <SidebarItem href="/vault" icon={KeyRound}>Vault</SidebarItem>
      <SidebarItem href="/channels" icon={Radio}>Channels</SidebarItem>
      <SidebarItem href="/permissions" icon={Lock}>Permissions</SidebarItem>
      <SidebarItem href="/usage" icon={BarChart3}>Usage</SidebarItem>
      <SidebarItem href="/logs" icon={ScrollText}>Logs</SidebarItem>
      <SidebarItem href="/settings" icon={Settings}>Settings</SidebarItem>
    </SidebarGroup>
  </SidebarContent>

  <SidebarFooter>
    <ActiveRunsWidget /> {/* pipelines/harness ativos */}
    <UserMenu />
  </SidebarFooter>
</Sidebar>
```

#### 4.3.2 Topbar redesenhada

```typescript
// apps/web/components/layout/topbar.tsx
<Topbar>
  <Breadcrumb>
    <BreadcrumbList>
      <BreadcrumbItem href="/">Home</BreadcrumbItem>
      <BreadcrumbSeparator />
      <BreadcrumbItem>{currentPageLabel}</BreadcrumbItem>
    </BreadcrumbList>
  </Breadcrumb>

  <TopbarRight>
    <CommandK /> {/* Cmd+K */}
    <NotificationsDropdown />
    <ThemeToggle />
    <UserMenu />
  </TopbarRight>
</Topbar>
```

#### 4.3.3 PageHeader reutilizável

```typescript
// apps/web/components/layout/page-header.tsx
<PageHeader
  title="Agents"
  description="Manage custom AI agents and their configurations"
  actions={
    <>
      <Button variant="outline" onClick={handleSync}>
        <RefreshCw className="mr-2 h-4 w-4" />
        Sync Orchestrator
      </Button>
      <Button onClick={() => setModal({ open: true })}>
        <Plus className="mr-2 h-4 w-4" />
        New Agent
      </Button>
    </>
  }
  stats={
    <StatCard label="Total" value={stats.total} />
    // ...
  }
/>
```

### 4.4 Telas Específicas — Redesign

#### 4.4.1 Chat Page — `/chat`

**Estado atual:** Funcional mas sem polish
**Melhorias:**
- Layout split-pane: sessions list (esquerda) + chat (centro) + context panel (direita)
- Empty state elegante quando sem mensagens
- Token counter com gráfico sparkline
- Voice orb flutuante (canto inferior direito)
- Auto-scroll inteligente

```typescript
<ChatLayout>
  <ChatSidebar>
    <SessionList sessions={sessions} active={active} onSelect={setActive} />
    <Button variant="outline" onClick={createSession}>
      <Plus /> New Chat
    </Button>
  </ChatSidebar>

  <ChatMain>
    <ChatHeader>
      <ModelPicker /> {/* provider + model selection */}
      <TokenCounter />
      <VoiceToggle />
    </ChatHeader>

    <ChatMessages>
      {messages.map(m => <MessageBubble key={m.id} message={m} />)}
      {isStreaming && <TypingIndicator />}
    </ChatMessages>

    <ChatInput onSend={send} onAttach={attach} />
  </ChatMain>

  <ChatContextPanel>
    <AgentInfo />
    <ToolCallsList />
    <UsageStats />
  </ChatContextPanel>
</ChatLayout>
```

#### 4.4.2 Harness Page — `/harness`

**Estado atual:** Falta tela de execução dedicada
**Melhorias:**
- Após criar projeto, navegar para `/harness/[id]/execute`
- Layout 3 colunas: SprintList | ExecutionStream | Metrics
- Progress bar animada
- Run controls: Run / Pause / Abort / Reset

```typescript
<HarnessLayout>
  <HarnessSidebar>
    <ProjectList projects={projects} active={activeId} />
  </HarnessSidebar>

  <HarnessMain>
    {isExecuting ? (
      <HarnessExecutionView
        project={project}
        onAbort={abort}
        onComplete={navigateToReport}
      />
    ) : (
      <HarnessProjectDetail
        project={project}
        sprints={sprints}
        onStart={startExecution}
      />
    )}
  </HarnessMain>
</HarnessLayout>
```

**`HarnessExecutionView` (3 colunas):**
```typescript
<ResizablePanelGroup direction="horizontal">
  <ResizablePanel defaultSize={25}>
    <SprintList sprints={sprints} active={activeSprint} />
    <MetricsView metrics={metrics} />
  </ResizablePanel>

  <ResizableHandle />

  <ResizablePanel defaultSize={75}>
    <AgentStreamPanel
      plannerStream={plannerStream}
      coderStream={coderStream}
      evaluatorStream={evaluatorStream}
    />
    <ChatInput onSend={sendMessage} /> {/* permite interação durante execução */}
    <RunControls
      state={runState} // idle|running|done|aborted|error
      onRun={run}
      onAbort={abort}
      onRunAgain={runAgain}
    />
  </ResizablePanel>
</ResizablePanelGroup>
```

#### 4.4.3 Pipeline Page — `/pipeline`

**Estrutura similar ao Harness:**
```typescript
<PipelineLayout>
  <PipelineSidebar>
    <ProjectList type="pipeline" />
  </PipelineSidebar>

  <PipelineMain>
    {isExecuting ? (
      <PipelineExecutionView>
        <PhaseProgressBar phases={phases} current={current} />
        <PipelineChatView phase={currentPhase} />
        <PipelineStreamView stream={stream} />
        <PhaseActionButtons
          phase={currentPhase}
          onApprove={approve}
          onReject={reject}
        />
      </PipelineExecutionView>
    ) : (
      <PipelineProjectDetail />
    )}
  </PipelineMain>
</PipelineLayout>
```

#### 4.4.4 Agents Page — `/agents`

**Layout padrão LionClaw:**
- Tabela com colunas: Name | Description | Provider | Model | Status | Actions
- Botão "New Agent" no header
- Ação "Sync Orchestrator" em massa
- Edição abre nova tela `/agents/[id]/edit` (NÃO modal)

```typescript
<AgentsView>
  <PageHeader
    title="Agents"
    description="Custom AI personas with tools, skills, and runtime configuration"
    actions={
      <>
        <Button variant="outline" onClick={handleSync}>
          <RefreshCw /> Sync Orchestrator
        </Button>
        <Button onClick={navigateToCreate}>
          <Plus /> New Agent
        </Button>
      </>
    }
  />

  <DataTable
    columns={[
      { header: 'Name', accessorKey: 'name' },
      { header: 'Provider', accessorKey: 'provider' },
      { header: 'Model', accessorKey: 'model' },
      { header: 'Squad', accessorKey: 'squad' },
      { header: 'Status', cell: ({ row }) => <StatusBadge status={row.original.status} /> },
      { header: '', cell: ({ row }) => <RowActions onEdit={editAgent(row)} onDelete={deleteAgent(row)} /> },
    ]}
    data={agents}
  />
</AgentsView>
```

#### 4.4.5 Skills Page — `/skills`

**Mesmo padrão de agents:**
- Tabela com: Name | Description | Tags | Status | Actions
- Edição em nova tela `/skills/[id]/edit` com MarkdownEditor

#### 4.4.6 Rules Page — `/rules`

**Mesmo padrão:**
- Tabela com: Title | Kind | Enabled | Actions
- MarkdownEditor no body

#### 4.4.7 MCPs Page — `/mcp-servers`

**Layout:**
- Grid de cards (2 colunas em desktop)
- Cada card: Name | Description | Status badge | Health | Actions

```typescript
<McpServersView>
  <PageHeader
    title="MCP Servers"
    description="Model Context Protocol servers for extending agent capabilities"
    actions={
      <Button onClick={() => setModal({ open: true })}>
        <Plus /> Add MCP
      </Button>
    }
  />

  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    {servers.map(server => (
      <McpServerCard
        key={server.id}
        server={server}
        onToggle={toggleServer}
        onRestart={restartServer}
        onDelete={deleteServer}
      />
    ))}
  </div>
</McpServersView>
```

#### 4.4.8 Providers Page — `/settings/providers`

**Layout padrão (cards):**
- Cards de providers com: Name | Models count | Status | Override/Edit/Delete
- Modal de edição: name, displayName, baseUrl, apiKey (masked), models (array)

#### 4.4.9 Projects Page — `/projects` (NOVO)

**Nova rota dedicada para cadastro de projetos (path):**
```typescript
// apps/web/app/(app)/projects/page.tsx
<ProjectsView>
  <PageHeader
    title="Projects"
    description="Register project paths for use with Harness and Pipeline"
    actions={
      <Button onClick={openCreate}>
        <Plus /> New Project
      </Button>
    }
  />

  <DataTable
    columns={[
      { header: 'Name', accessorKey: 'name' },
      { header: 'Path', accessorKey: 'path', cell: ({ row }) => <code>{row.original.path}</code> },
      { header: 'Type', accessorKey: 'type' },
      { header: 'Created', accessorKey: 'createdAt' },
      { header: '', cell: ({ row }) => <RowActions /> },
    ]}
    data={projects}
  />
</ProjectsView>
```

**Backend — adicionar entity `Project` + use cases:**
- `CreateProject`, `UpdateProject`, `DeleteProject`, `ListProjects`
- Schema: `projects(id, name, path, type, metadata, userId, createdAt, updatedAt)`
- Validar path com `validateProjectPath` (já existe em `worker/src/lib/project-path.ts`)

**Critérios de aceitação:**
- [ ] Sidebar segue padrão LionClaw
- [ ] Topbar funcional
- [ ] Chat com model picker + token counter
- [ ] Harness com tela de execução dedicada
- [ ] Pipeline com tela de execução dedicada
- [ ] Agents em nova tela de edição
- [ ] Skills/Rules/MCPs em formato tabela
- [ ] Projects page nova
- [ ] Mobile: SidebarTrigger no topbar
- [ ] `loading.tsx` em cada rota
- [ ] `not-found.tsx` global
- [ ] `error.tsx` com recovery

---

## 5. Fase 3 — Polimento dos Cadastros

> **Objetivo:** Padronizar todos os cadastros (Agents, Skills, Rules, MCPs, Providers, Channels) com layout moderno, MarkdownEditor, tabelas, edição dedicada.
> **Estimativa:** 3-4 dias.

### 5.1 Padrão Comum para Todos os Cadastros

```typescript
// Estrutura padrão de página de cadastro
<ResourceView<ResourceType>>  // HOC que padroniza layout
  <PageHeader title="..." description="..." actions={...} />
  <DataTable columns={...} data={...} />
</ResourceView>
```

### 5.2 Agents — Polimento Completo

**Ver B11.1 (nova tela de edição com split-pane)**

**Adições:**
- Drag-and-drop para reordenar skills/tools
- Validação Zod no boundary
- Bulk actions (selecionar múltiplos → delete, sync, duplicate)
- Filtros (por squad, runtime, status)
- Busca em tempo real

### 5.3 Skills — Polimento

**Layout:** Tabela + nova tela de edição
- Colunas: Name | Description | Tags | Built-in | Status
- Edição: `/skills/[id]/edit` com MarkdownEditor (mesmo padrão de agents)
- Tags como badges coloridas

### 5.4 Rules — Polimento

**Layout:** Tabela agrupada por `kind`
- Colunas: Title | Kind | Enabled | Updated | Actions
- Edição inline com MarkdownEditor (substituir textarea)
- Preview do prompt final composto (BuildSystemPrompt)

### 5.5 MCPs — Polimento

**Layout:** Cards (2 colunas)
- Cada card: Name | Description | Status badge | Health | Visibility | Actions
- Ações: Toggle (on/off), Restart, Edit (command/args), Delete
- Modal "Add MCP" com formulário: name, description, command, args[], env[]

**Adicionar PUT para editar command/args/env:**
```typescript
// apps/worker/src/routes/mcp-servers.ts
server.put<{ Params: { id: string }; Body: McpServerUpdate }>(
  '/mcp-servers/:id',
  { preHandler: [server.authenticate] },
  async (request, reply) => {
    const { id } = request.params;
    return mcpServerRepo.update(id, request.body);
  }
);
```

### 5.6 Providers — Polimento

**Layout:** Cards de providers
- Cada card: Name | Models | Runtime | Status | Actions
- Ações: Edit (PUT), Delete (DELETE), Override (built-in → custom)
- Modal de edição: name, displayName, baseUrl, apiKey (password input), models (lista editável)

**Diferenciação Create vs Edit:**
- Botão "Create" para novo provider
- Botão "Update" para provider existente
- PUT para edição (NÃO POST)

### 5.7 Channels — Implementação Real

**Estado atual:** Só Telegram implementado, outros "em breve"
**Solução:** Implementar Slack/Discord/WhatsApp ou marcar como deferred no roadmap

```typescript
// apps/web/components/channels/channels-view.tsx
const channels = [
  {
    id: 'telegram',
    name: 'Telegram',
    status: 'available',
    component: <TelegramSetup />,
  },
  {
    id: 'slack',
    name: 'Slack',
    status: 'coming_soon',
    description: 'Available in v1.1',
  },
  // ... discord, whatsapp
];
```

**Critérios de aceitação:**
- [ ] Agents: nova tela `/agents/[id]/edit` com split-pane
- [ ] Agents: provider/model dinâmico em todos runtimes
- [ ] Skills: nova tela `/skills/[id]/edit` com MarkdownEditor
- [ ] Rules: MarkdownEditor + preview do prompt
- [ ] MCPs: PUT endpoint + edição de command/args
- [ ] Providers: PUT endpoint + diferenciação Create/Edit
- [ ] Channels: marcar deferred (não fake "em breve")

---

## 6. Fase 4 — Paridade LionClaw — Features Faltantes

> **Objetivo:** Portar features LionClaw que Wolfkrow não tem.
> **Estimativa:** 5-6 dias.

### 6.1 Cadastro de Projetos Dedicado (já parcialmente em 4.4.9)

**Já descrito em 4.4.9** — implementar entity + use cases + UI.

### 6.2 Configuração de Channel (Telegram completo)

**Estado atual:** Setup básico, sem configuração avançada
**Melhorias:**
- Paring flow com QR code (igual LionClaw)
- Múltiplas sessões Telegram (read-only na sidebar)
- Comandos `/new`, `/sessions`, `/switch`, `/memory`, `/schedule`
- Session list separada de chat local

### 6.3 Auditoria de Execução de SDK's (anthropic-compat com override)

**Objetivo:** Garantir que GLM/Kimi/MiniMax/Qwen são executados via `claude-compat` com override correto.

**Análise do fluxo atual:**
```typescript
// packages/infra/src/orchestrator/orchestrator.ts
function createProvider(config: ProviderConfig) {
  if (config.runtime === 'claude-compat') {
    return new ClaudeCompatProvider({
      baseURL: config.baseUrl,    // override
      apiKey: config.apiKey,      // override
      model: config.model,         // override
    });
  }
  // ...
}
```

**Verificação necessária:**
- [ ] `ClaudeCompatProvider` aceita `baseURL`, `apiKey`, `model` corretamente
- [ ] Override de URL funciona (teste com Z.ai: `https://api.z.ai/api/anthropic`)
- [ ] Override de API key funciona (keytar)
- [ ] Override de model funciona (não cai no default)

**Adicionar testes:**
```typescript
// packages/infra/src/orchestrator/__tests__/claude-compat.test.ts
describe('ClaudeCompatProvider', () => {
  it('uses custom baseURL for Z.ai', async () => {
    const provider = new ClaudeCompatProvider({
      baseURL: 'https://api.z.ai/api/anthropic',
      apiKey: 'test',
      model: 'glm-4.6',
    });
    // Verificar que o client é criado com baseURL custom
  });

  it('uses custom baseURL for MiniMax', async () => { /* ... */ });
  it('uses custom baseURL for Moonshot', async () => { /* ... */ });
  it('uses custom baseURL for Qwen', async () => { /* ... */ });
});
```

### 6.4 Integração OpenDesign

**Estado atual:** Placeholder (`/studio` mostra "will be available")
**Decisão (do audit):** v1.0 = fora de escopo
**Solução:** Remover do sidebar ou marcar claramente como "v1.1"

```typescript
// sidebar.tsx — manter "Design Studio" mas com badge "Coming Soon"
// OU: remover temporariamente
```

**OU:** Migrar `vendor/open-design/` (106MB) para `apps/sidecar/` e implementar.

**Decisão recomendada:** Remover do sidebar v1.0, adicionar de volta em v1.1 com implementação real.

### 6.5 Tipos de Pipeline (parcial)

**Estado atual:** 1 pipeline simplificado
**LionClaw:** 5 tipos (development, development-v2, feature, security, architecture-review)
**Decisão:** Adicionar tipos via `pipelineType` enum

```typescript
// packages/domain/src/entities/pipeline-project.ts
type PipelineType =
  | 'development'
  | 'development-v2'  // com Open Design
  | 'feature'
  | 'security'
  | 'architecture-review';
```

**Migration:**
```typescript
// Adicionar coluna pipelineType em pipeline_projects
ALTER TABLE pipeline_projects ADD COLUMN type TEXT NOT NULL DEFAULT 'development';
```

**UI:** Dropdown de seleção no NewPipelineModal.

### 6.6 Sprint Metrics Detalhadas

**LionClaw tem:** `MetricsChart` (D3) com tokens, cost, duration, tool uses, API requests
**Wolfkrow tem:** `MetricsView` simples
**Solução:** Adicionar recharts (já é dependência) com:
- Line chart: tokens per sprint
- Bar chart: cost per sprint
- Area chart: duration timeline
- Pie chart: tool calls distribution

### 6.7 MCP Tools List Expandable

**LionClaw:** Lista tools com annotations (destructive/readOnly)
**Wolfkrow:** Não implementado
**Solução:** Adicionar endpoint `GET /mcp-servers/:id/tools`

```typescript
// apps/worker/src/routes/mcp-servers.ts
server.get<{ Params: { id: string } }>(
  '/mcp-servers/:id/tools',
  { preHandler: [server.authenticate] },
  async (request) => {
    const tools = await mcpManager.listTools(request.params.id);
    return { tools };
  }
);
```

**UI:** Expandable section no card de MCP.

### 6.8 Codeburn Terminal (já implementado)

**Estado:** 🟢 Funcionando com xterm + WebSocket + node-pty

**Melhorias opcionais:**
- Múltiplas sessões (tabs)
- Save output to file
- Search within terminal

**Critérios de aceitação:**
- [ ] Cadastro de projeto dedicado
- [ ] Telegram: pairing QR + session list
- [ ] SDK execution audit (4 claude-compat providers testados)
- [ ] OpenDesign: removido do sidebar v1.0
- [ ] Pipeline types: 5 tipos suportados
- [ ] Sprint metrics com recharts
- [ ] MCP tools list expandable

---

## 7. Fase 5 — Eliminação de Débitos Técnicos

> **Objetivo:** Resolver 15+ débitos técnicos rastreados (// DEBT #XX, try/catch silenciosos, etc).
> **Estimativa:** 2-3 dias.

### 7.1 Débitos Identificados

| # | Débito | Arquivo | Fix |
|---|---|---|---|
| DEBT #1 | Permission store em memória | `permission-store.ts:20` | Persistir no DB |
| DEBT #2 | Abort/Stop não propaga | `claude-compat.ts:107,153` | Passar `signal` para `executeTool` |
| DEBT #3 | ClaudeCompatProvider silencia tools | `orchestrator.ts:128-133` | Usar `createFromConfig` |
| DEBT #4 | SSE `ask_question` morto | `chat-hooks.ts:28,196` | Worker emitir evento ou remover |
| DEBT #5 | SSE `log-stream` sem auth | `apps/worker/src/routes/logs.ts` | Adicionar `preHandler: [server.authenticate]` |
| DEBT #6 | 134x `as unknown as` | vários | Investigar + remover |
| DEBT #7 | try/catch silenciosos (8+) | `agents-view.tsx:57`, etc | Adicionar log + toast |
| DEBT #8 | Worker coverage real 55% (cfg 25%) | `apps/worker/vitest.config.ts` | Subir threshold para 85% |
| DEBT #9 | shared-types 0% branch | `packages/shared-types/vitest.config.ts` | Adicionar testes + subir threshold |
| DEBT #10 | 2 layouts de settings | `settings-view.tsx` + `settings-shell.tsx` | Remover duplicação |
| DEBT #11 | Topbar sem SidebarTrigger mobile | `topbar.tsx` | Adicionar `<SidebarTrigger />` |
| DEBT #12 | Falta `loading.tsx` por rota | todas as rotas | Adicionar |
| DEBT #13 | Falta `not-found.tsx` | `app/` | Adicionar global |
| DEBT #14 | Shadow Zod schemas (20+) | `apps/worker/src/routes/*` | Importar shared-types |
| DEBT #15 | Audit doc desatualizado | `docs/AUDITORIA_GERAL_2026-06-24.md` | Atualizar |

### 7.2 Script de Detecção Automática

```bash
# scripts/check-debts.sh
#!/bin/bash
set -e

echo "🔍 Procurando débitos técnicos..."

# DEBT #6: as unknown as
COUNT=$(grep -r "as unknown as" apps packages --include="*.ts" --include="*.tsx" | wc -l)
echo "❌ DEBT #6: $COUNT ocorrências de 'as unknown as' (target: 0)"

# DEBT #7: try/catch silenciosos
COUNT=$(grep -rn "} catch" apps packages --include="*.ts" --include="*.tsx" -A 1 | grep -E "//\s*graceful|//\s*ignore" | wc -l)
echo "❌ DEBT #7: $COUNT try/catch silenciosos (target: 0)"

# DEBT #11: SidebarTrigger ausente
COUNT=$(grep -L "SidebarTrigger" apps/web/components/layout/topbar.tsx | wc -l)
echo "❌ DEBT #11: topbar sem SidebarTrigger (target: 0)"

# DEBT #14: shadow Zod schemas
COUNT=$(grep -r "z\.object(" apps/worker/src/routes --include="*.ts" | wc -l)
echo "❌ DEBT #14: $COUNT z.object em routes worker (target: 0)"

# DEBT #15: cobertura real
COVERAGE=$(pnpm coverage:worker 2>/dev/null | tail -1 | grep -oE "[0-9]+%" | head -1)
echo "❌ DEBT #8: worker coverage = $COVERAGE (target: ≥85%)"
```

**Critérios de aceitação:**
- [ ] 0 débitos rastreados ativos
- [ ] Script `check-debts.sh` retorna 0
- [ ] Cobertura real ≥85% em todos packages

---

## 8. Fase 6 — Cobertura de Testes Rigorosa

> **Objetivo:** Garantir que testes validam o código (não são smoke tests vazios).
> **Estimativa:** 2-3 dias.

### 8.1 Auditoria de Testes

Para cada arquivo `.test.ts`:
- [ ] Cobre o caminho feliz
- [ ] Cobre casos de erro
- [ ] Cobre edge cases (null, undefined, empty)
- [ ] Usa `expect()` com matcher específico (não `toBeTruthy()`)
- [ ] Não tem `expect(true).toBe(true)`
- [ ] Não tem `// @ts-ignore` ou `as any`

### 8.2 Subir Thresholds

```typescript
// vitest.config.ts (root)
export default defineConfig({
  test: {
    coverage: {
      thresholds: {
        lines: 85,
        functions: 85,
        branches: 80,
        statements: 85,
      },
    },
  },
});
```

**Por package:**
- `packages/domain`: 95% (lógica pura)
- `packages/use-cases`: 90%
- `packages/infra`: 85%
- `apps/worker`: 85% (subir de 25%)
- `apps/web`: 70% (UI), 80% (forms/auth)
- `packages/shared-types`: 80% (subir de 25%/0%)

### 8.3 Testes de Integração

**Adicionar:**
- E2E: fluxo completo de chat com agent (resolver B1 + B7)
- E2E: criar projeto harness → executar → ver SSE stream → métricas
- E2E: criar pipeline → aprovar → implementar
- E2E: CRUD de cada recurso (agents, skills, rules, MCPs, providers)
- E2E: 5 tentativas erradas → lockout
- E2E: session expira (30d) → redirect /unlock

### 8.4 Property-Based Testing (opcional)

Para value objects e domain entities, usar `fast-check` para property tests.

**Critérios de aceitação:**
- [ ] Todos thresholds atingidos
- [ ] 0 testes com `expect(true).toBe(true)`
- [ ] 50+ E2E testes cobrindo fluxos críticos
- [ ] CI bloqueia merge se coverage cair

---

## 9. Fase 7 — Auditoria Final de Validação

> **Objetivo:** Validação rigorosa e completa do projeto após todas as correções.
> **Estimativa:** 2-3 dias.

### 9.1 Checklist de Validação Detalhado

#### 9.1.1 Funcionalidades Core

| # | Item | Como Validar | Status |
|---|---|---|---|
| 1 | Login (senha + TOTP) | `pnpm test auth` + E2E login | ☐ |
| 2 | Token expira em 30d | Verificar `jwt.ts:46` + teste | ☐ |
| 3 | Bloqueio APENAS após 30d | E2E: deixar app aberto 31 dias simulado (mock tempo) | ☐ |
| 4 | Chat streaming com SSE | E2E: enviar msg → receber stream | ☐ |
| 5 | Chat com agent (FK fix) | E2E: New Chat → send → OK | ☐ |
| 6 | Chat com provider selection | E2E: escolher provider → modelo | ☐ |
| 7 | Voice conversation | E2E: falar → STT → TTS | ☐ |
| 8 | Knowledge upload + search | E2E: upload PDF → search | ☐ |
| 9 | Harness execution | E2E: criar projeto → executar → ver SSE | ☐ |
| 10 | Pipeline approval | E2E: criar pipeline → aprovar → implementar | ☐ |
| 11 | MCP CRUD | E2E: criar MCP → list → toggle | ☐ |
| 12 | Agent CRUD + sync | E2E: criar agent → sync orchestrator | ☐ |
| 13 | Skill CRUD | E2E: criar skill → attach to agent | ☐ |
| 14 | Rule CRUD | E2E: criar rule → ver no prompt | ☐ |
| 15 | Provider CRUD (PUT) | E2E: criar provider → editar → ver atualizado | ☐ |
| 16 | Channel setup (Telegram) | E2E: setup Telegram → pairing | ☐ |
| 17 | PTY terminal | E2E: abrir terminal → comando | ☐ |
| 18 | Logs live tail | E2E: ver logs streaming | ☐ |
| 19 | Permissions CRUD | E2E: criar permission → ver aplicada | ☐ |
| 20 | Usage charts | E2E: ver charts com dados | ☐ |

#### 9.1.2 Layout e UI/UX

| # | Item | Como Validar | Status |
|---|---|---|---|
| 1 | Sidebar com todos os itens | Inspeção visual | ☐ |
| 2 | Topbar com Cmd+K | Inspeção visual | ☐ |
| 3 | PageHeader em todas as páginas | Inspeção visual | ☐ |
| 4 | Mobile: SidebarTrigger | DevTools mobile mode | ☐ |
| 5 | Loading skeletons em todas as rotas | Network throttle | ☐ |
| 6 | Empty states | Acessar página sem dados | ☐ |
| 7 | Error boundaries | Forçar erro 500 | ☐ |
| 8 | 404 page | Navegar para /rota-inexistente | ☐ |
| 9 | Dark mode | Toggle theme | ☐ |
| 10 | Acessibilidade WCAG 2.1 AA | `pnpm test:a11y` (axe) | ☐ |

#### 9.1.3 Integração Backend↔Frontend

| # | Item | Como Validar | Status |
|---|---|---|---|
| 1 | Contracts validados via Zod | Test E2E + shared-types | ☐ |
| 2 | 0 shadow schemas | `grep "z\.object(" apps/worker/src/routes` | ☐ |
| 3 | SSE reconexão automática | E2E: matar worker → restart | ☐ |
| 4 | WebSocket reconnect (PTY) | E2E: matar worker → restart | ☐ |
| 5 | Auth propagado em todos endpoints | Test: 401 sem token | ☐ |

#### 9.1.4 Qualidade de Código

| # | Item | Como Validar | Status |
|---|---|---|---|
| 1 | Lint passa | `pnpm lint` | ☐ |
| 2 | Typecheck passa | `pnpm typecheck` | ☐ |
| 3 | 0 débitos rastreados | `pnpm check:debts` | ☐ |
| 4 | 0 `as unknown as` | grep | ☐ |
| 5 | 0 try/catch silenciosos | grep | ☐ |
| 6 | Sem código morto | `pnpm ts-prune` | ☐ |
| 7 | Sem TODOs | `grep "TODO\|FIXME"` | ☐ |

#### 9.1.5 Segurança

| # | Item | Como Validar | Status |
|---|---|---|---|
| 1 | SSRF fix | Test: tentar IP privado | ☐ |
| 2 | JWT em cookies httpOnly | Verificar response headers | ☐ |
| 3 | Secrets nunca expostos ao browser | Inspecionar network | ☐ |
| 4 | Rate limit em endpoints sensíveis | Test: 11 requests em 1min | ☐ |
| 5 | TOTP rate limit | Test: brute force 6 dígitos | ☐ |
| 6 | SQL injection | Test: input com `'; DROP TABLE--` | ☐ |
| 7 | XSS prevention | Test: `<script>alert(1)</script>` em input | ☐ |
| 8 | CSP headers | Inspecionar response | ☐ |

#### 9.1.6 Performance

| # | Item | Target | Como Medir | Status |
|---|---|---|---|---|
| 1 | TTFB em rotas RSC | <200ms P95 | Lighthouse | ☐ |
| 2 | Chat SSE TTFT | <500ms P95 | Métricas worker | ☐ |
| 3 | Search knowledge 10k chunks | <100ms P95 | Benchmark | ☐ |
| 4 | LCP (Largest Contentful Paint) | <2.5s | Lighthouse | ☐ |
| 5 | CLS | <0.1 | Lighthouse | ☐ |
| 6 | Bundle size | <500KB JS | `pnpm build:analyze` | ☐ |
| 7 | Memory usage | <500MB idle | Chrome DevTools | ☐ |

### 9.2 Script de Auditoria Automatizada

```bash
#!/bin/bash
# scripts/audit-mvp.sh
set -e
cd "$(dirname "$0")/.."

echo "🔍 AUDITORIA FINAL DO MVP — $(date)"
echo "===================================="

# 1. Build
echo "📦 [1/10] Build..."
pnpm build || exit 1

# 2. Lint
echo "🔎 [2/10] Lint..."
pnpm lint || exit 1

# 3. Typecheck
echo "📐 [3/10] Typecheck..."
pnpm typecheck || exit 1

# 4. Tests
echo "🧪 [4/10] Tests..."
pnpm test -- --run || exit 1

# 5. Coverage
echo "📊 [5/10] Coverage..."
pnpm test:coverage || exit 1

# 6. E2E
echo "🎭 [6/10] E2E..."
pnpm test:e2e || exit 1

# 7. Security audit
echo "🔒 [7/10] Security..."
pnpm audit:security || exit 1

# 8. Bundle size
echo "📏 [8/10] Bundle size..."
pnpm build:analyze || true

# 9. Performance
echo "⚡ [9/10] Performance..."
pnpm lighthouse || true

# 10. Débitos
echo "💳 [10/10] Débitos técnicos..."
pnpm check:debts || exit 1

echo "===================================="
echo "✅ AUDITORIA CONCLUÍDA COM SUCESSO"
echo "===================================="
```

### 9.3 Critérios de Aceitação Globais (Release Gate)

Para o release do MVP, TODOS os itens abaixo devem ser ✅:

- [ ] 0 bugs BLOCKER ativos
- [ ] 0 bugs MAJOR ativos
- [ ] 0 débitos técnicos rastreados ativos
- [ ] Cobertura ≥85% (real, não mascarada)
- [ ] 100% das 22 SPECs implementadas (ou descoped formalmente)
- [ ] 100% dos 33 ADRs respeitados
- [ ] Layout polido, moderno, minimalista
- [ ] 0 shadow schemas
- [ ] SSRF corrigido
- [ ] Token 30d + lock após expiração
- [ ] Todas as 20 funcionalidades LionClaw portadas
- [ ] Acessibilidade WCAG 2.1 AA
- [ ] Performance P95 dentro dos targets
- [ ] Segurança OK (audit sem findings críticos)
- [ ] Documentação atualizada (FEATURE_MATRIX, AUDIT_REPORT, MIGRATION_FROM_LIONCLAW)
- [ ] CHANGELOG atualizado
- [ ] Build de produção sem warnings

---

## 10. Critérios de Aceitação Globais

### 10.1 MVP Completo = TODAS as Condições Verdadeiras

| Dimensão | Critério | Métrica |
|---|---|---|
| **Paridade LionClaw** | 100% das features core portadas | 20/20 páginas, 5/5 tipos pipeline |
| **Funcional** | 0 bugs blocker | `pnpm audit:bugs` |
| **Limpo** | 0 débitos técnicos | `pnpm check:debts` |
| **Testado** | Cobertura ≥85% real | `pnpm test:coverage` |
| **Tipado** | TypeScript strict sem `any` | `pnpm typecheck` |
| **Lintado** | ESLint 0 erros | `pnpm lint` |
| **Documentado** | 22 SPECs, 33 ADRs, FEATURE_MATRIX atualizados | Manual review |
| **Performante** | Lighthouse ≥90 em todas categorias | `pnpm lighthouse` |
| **Seguro** | 0 vulnerabilidades críticas | `pnpm audit` |
| **Acessível** | WCAG 2.1 AA | `pnpm test:a11y` |
| **PWA** | Installable, offline shell | Chrome DevTools |

### 10.2 Não-Objetivos (YAGNI)

- Mobile companion (v1.2)
- Cloud sync (v1.2)
- Plugin marketplace (v1.1)
- LoRA fine-tuning (v2.0)
- Real-time collaboration (v2.0)
- Open Design Studio real (v1.1)
- Multi-workspace (v1.1)
- Screen awareness (v1.2)
- Higgsfield + Blotato MCPs (v2.0)
- mgraph structured vault ROAM-like (deferred)

---

## 11. Plano de Rollback

### 11.1 Estratégia de Branch

```
main
├── release/mvp-v1.0          (tagged, deployed)
├── feature/fase-0-blockers   (in progress)
├── feature/fase-1-major      (parallel)
├── feature/fase-2-uiux       (depends on 0,1)
├── feature/fase-3-cadastros  (depends on 2)
├── feature/fase-4-paridade   (depends on 2)
├── feature/fase-5-debts      (parallel)
├── feature/fase-6-tests      (depends on all)
└── feature/fase-7-audit      (depends on all)
```

### 11.2 Critérios de Rollback

- Bug crítico introduzido em produção → `git revert` + hotfix
- Coverage cair >5% em uma fase → merge bloqueado
- E2E suite >10% falhando → merge bloqueado
- Performance regression >20% → investigar + rollback

### 11.3 Migration de Volta (se necessário)

```bash
# Se LionClaw for necessário
pnpm migrate:lionclaw --from .wolfkrow/data/wolfkrow.db --rollback \
  --to ~/.lionclaw/data/lionclaw.db
```

---

## 12. Métricas de Sucesso

### 12.1 KPIs Técnicos

| KPI | Target | Baseline (atual) |
|---|---|---|
| Cobertura de testes (real) | ≥85% | 55% worker, 0% shared-types |
| Bugs conhecidos | 0 | 15 |
| Débitos técnicos | 0 | 15+ |
| Latência P95 (chat TTFT) | <500ms | ? |
| Lighthouse Performance | ≥90 | ? |
| Bundle size (gzipped) | <500KB | ? |
| LCP | <2.5s | ? |
| CLS | <0.1 | ? |
| Tempo de build | <5min | ? |

### 12.2 KPIs de Paridade

| KPI | Target | Baseline |
|---|---|---|
| Páginas LionClaw portadas | 20/20 | ~18/20 |
| Tipos de pipeline | 5/5 | 1/5 |
| MCPs portados | 15/15 | 15/15 (scaffold) |
| Seed agents | 70/70 | 65/70 |

### 12.3 KPIs de Qualidade

| KPI | Target |
|---|---|
| ESLint errors | 0 |
| TypeScript errors | 0 |
| `as any` count | 0 |
| `as unknown as` count | 0 |
| try/catch silenciosos | 0 |
| Shadow Zod schemas | 0 |
| Dead code | 0 |

---

## 13. Anexos

### 13.1 Arquivos a Modificar por Fase

| Fase | Arquivos | LOC Estimado |
|---|---|---|
| Fase 0 | 8 | ~200 |
| Fase 1 | 18 | ~500 |
| Fase 2 | 25 | ~1500 (UI) |
| Fase 3 | 12 | ~800 |
| Fase 4 | 20 | ~1200 |
| Fase 5 | 30 | ~400 |
| Fase 6 | 40 (tests) | ~1000 (tests) |
| Fase 7 | 5 (scripts) | ~300 (scripts) |

### 13.2 Dependências a Adicionar (se necessário)

```json
{
  "ipaddr.js": "^2.2.0",        // SSRF fix
  "fast-check": "^3.20.0",      // property tests
  "@axe-core/playwright": "^4.10.0"  // a11y E2E
}
```

### 13.3 Referências

- `docs/ARCHITECTURE.md` — arquitetura clean
- `docs/PRD.md` — requisitos de produto
- `docs/FEATURE_MATRIX.md` — matriz de features
- `docs/MIGRATION_FROM_LIONCLAW.md` — migração
- `docs/specs/SPEC-001..022` — 22 specs
- `docs/adr/0001..0033` — 33 ADRs
- `AGENT.md` — guia do agente

---

## 14. Resumo Executivo Final

### 14.1 O Que Será Entregue

**Correções (15 bugs):**
- 3 BLOCKERS (FK chat, MCP não exibe, SSRF)
- 8 MAJOR (PUT providers, agent edit dinâmico, harness/pipeline execution UI, etc)
- 4 MINOR (rules textarea, auto-lock 5min, layout, etc)

**Features Novas (8):**
- Cadastro de projeto dedicado
- Channel config (Telegram completo)
- 5 tipos de pipeline
- Sprint metrics com recharts
- MCP tools list expandable
- Agent edit em nova tela com split-pane
- Projects page
- Audit SDK execution

**Melhorias UI/UX (12):**
- Sidebar redesenhada (padrão LionClaw)
- Topbar com Cmd+K
- PageHeader reutilizável
- Tabelas padronizadas (agents, skills, rules, MCPs)
- Modal de edição polido
- Mobile responsivo (SidebarTrigger)
- Loading skeletons
- Empty states
- Error boundaries
- 404 custom
- Markdown editor em todas as telas
- Acessibilidade WCAG 2.1 AA

**Qualidade (15 débitos):**
- 0 `as unknown as`
- 0 try/catch silenciosos
- 0 shadow Zod schemas
- Cobertura real ≥85%
- CI bloqueando regressões
- Script de auditoria automatizado

### 14.2 Cronograma

| Semana | Fases | Entregas |
|---|---|---|
| 1 | Fase 0 + 1 + 5 (paralelo) | 15 bugs corrigidos, 0 débitos |
| 2 | Fase 2 + 3 | UI/UX polido, cadastros padronizados |
| 3 | Fase 4 + 6 | Paridade LionClaw + testes |
| 4 | Fase 7 | Auditoria final, release MVP |

### 14.3 Próximos Passos Imediatos

1. **Criar branch `feature/fase-0-blockers`**
2. **Implementar B1 (FK fix)** — 1 dia
3. **Implementar B2+B4+B5 (provider CRUD)** — 1 dia
4. **Investigar B3 (MCP)** — 0.5 dia
5. **Executar `pnpm audit:final` antes de merge**

---

**Plano gerado em:** 2026-06-26
**Versão:** 2.0 (mvp_final_plan_v2_minimax)
**Próxima revisão:** Após Fase 0
**Owner:** Wolfkrow Engineering Team
