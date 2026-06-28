# ADR-0005: Zod Schemas como Single Source of Truth

**Status**: ✅ Aceito
**Data**: 2026-06-20

## Contexto

O LionClaw v3 tem tipos TypeScript duplicados em vários lugares:

- `src/types/index.ts` (2506 linhas) — tipos do renderer
- `electron/main/db.ts` — tipos inferidos de rows SQLite (informal)
- IPC payloads sem validação runtime (strings + `any`)
- Seed agents em `.ts` (sem validação de schema)

Problemas:

1. **Duplicação**: mesmo tipo definido em 2-3 lugares
2. **Drift**: mudanças em 1 lugar não propagam
3. **Zero runtime safety**: API aceita payload inválido
4. **Documentação fraca**: JSDoc é manual e desatualizado

## Decisão

**Zod schemas são a única fonte de verdade**. TypeScript types são **inferidos** via `z.infer<>`.

```typescript
// packages/shared-types/src/schemas/agent.ts
import { z } from 'zod';

export const AgentSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  model: z.string(),
  effort: z.enum(['low', 'medium', 'high', 'max']),
  thinking: z.boolean().default(false),
  thinkingBudget: z.number().int().positive().optional(),
  maxTurns: z.number().int().positive().default(80),
  allowedTools: z.array(z.string()).default([]),
  mcpServers: z.array(z.string()).default([]),
  isActive: z.boolean().default(true),
  skills: z.array(z.string()).default([]),
  runtime: z.enum(['cloud', 'local', 'codex', 'external']),
  squad: z.enum(['harness', 'workflow', 'enrich', 'custom']).optional(),
  systemPrompt: z.string().optional(),
  metadata: z.record(z.unknown()).default({}),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type Agent = z.infer<typeof AgentSchema>;

// Partial variants para mutations
export const CreateAgentInputSchema = AgentSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type CreateAgentInput = z.infer<typeof CreateAgentInputSchema>;
```

## Consequências

### Positivas

- **DRY**: schema define validação + tipo + default + documentação
- **Runtime safety**: IPC payloads validados antes de processar
- **Auto-complete**: TypeScript infere tudo de Zod
- **Documentação viva**: Zod gera OpenAPI/JSON Schema
- **Refactor seguro**: mudar schema = atualizar 1 lugar, type errors apontam onde
- **Forms**: shadcn Form + react-hook-form + Zod = validação automática
- **Seed agents**: YAML validados com mesmo schema

### Negativas

- **Build time**: Zod parsing tem overhead (~10-20% vs tipos puros)
- **Bundle size**: Zod é ~50KB (mas tree-shakeable)
- **Learning curve**: devs precisam aprender Zod

### Mitigações

- Validação em boundaries (IPC, form, file load), não em hot paths
- Zod 4 é mais rápido que v3
- Tree-shaking remove schemas não usados

## Onde Aplicar

### 1. Shared Types (Single Source of Truth)

`packages/shared-types/src/schemas/`:

- `agent.ts` — Agent, CreateAgentInput, UpdateAgentInput
- `chat.ts` — Session, Message, Attachment
- `mcp.ts` — MCPServer, Tool
- `skill.ts` — Skill
- `knowledge.ts` — Document, Chunk, SearchQuery
- `harness.ts` — Project, Sprint, Round, Metrics
- `pipeline.ts` — Project, Phase, Artifact
- `scheduler.ts` — Task, Run, Activity
- `memory.ts` — SemanticMemory, DailySummary
- `vault.ts` — Secret
- `auth.ts` — User, LoginInput, TotpInput
- `settings.ts` — Settings, OrchestratorConfig
- `audit.ts` — AuditEntry
- `enrich.ts` — EnrichSession, EnrichMessage
- `workflow.ts` — WorkflowRun
- `usage.ts` — TokenUsage

### 2. IPC Validation (Route Handlers)

```typescript
// apps/web/app/api/agents/route.ts
import { AgentSchema, CreateAgentInputSchema } from '@wolfkrow/shared-types/schemas/agent';

export async function POST(req: NextRequest) {
  const body = await req.json();

  // Valida e parseia (throws ZodError se inválido)
  const input = CreateAgentInputSchema.parse(body);

  const useCase = container.get(CreateAgent);
  const agent = await useCase.execute(input);

  return Response.json(AgentSchema.parse(agent));
}
```

### 3. Form Validation (shadcn Form + react-hook-form)

```typescript
// apps/web/components/agents/AgentForm.tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CreateAgentInputSchema } from '@wolfkrow/shared-types/schemas/agent';

export function AgentForm() {
  const form = useForm({
    resolver: zodResolver(CreateAgentInputSchema),
    defaultValues: { ... },
  });

  return (
    <Form {...form}>
      <FormField
        control={form.control}
        name="name"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Name</FormLabel>
            <FormControl>
              <Input {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </Form>
  );
}
```

### 4. Seed Agents YAML Validation

```typescript
// apps/worker/src/seed-agents/loader.ts
import { AgentSchema } from '@wolfkrow/shared-types/schemas/agent';
import yaml from 'yaml';

export function loadSeedAgent(path: string): Agent {
  const content = readFileSync(path, 'utf-8');
  const data = yaml.parse(content);
  return AgentSchema.parse(data); // throws if invalid
}
```

### 5. SSE Event Validation

```typescript
// packages/shared-types/src/sse/chat-events.ts
export const ChatStreamChunkSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('text'), content: z.string() }),
  z.object({ type: z.literal('tool_call'), toolName: z.string(), input: z.unknown() }),
  z.object({ type: z.literal('tool_result'), toolName: z.string(), output: z.unknown() }),
  z.object({ type: z.literal('done'), sessionId: z.string(), metrics: z.object({...}) }),
  z.object({ type: z.literal('error'), message: z.string() }),
]);

export type ChatStreamChunk = z.infer<typeof ChatStreamChunkSchema>;
```

## Alternativas Consideradas

### A. TypeScript puro (status quo)

**Prós**: Zero overhead, familiar
**Contras**: Sem runtime validation, duplicação, drift
**Decisão**: ❌ Rejeitado — é o problema que estamos resolvendo

### B. Yup / Joi / AJV

**Yup**: menos type-safety
**Joi**: melhor para backend, mas sem type inference
**AJV**: JSON Schema based, mais boilerplate
**Decisão**: ❌ Rejeitado — Zod tem melhor DX + TypeScript integration

### C. io-ts

**Prós**: TypeScript-first, similar a Zod
**Contras**: Mais verboso, menos popular, ecossistema menor
**Decisão**: ❌ Rejeitado — Zod é mais popular e tem melhor DX

### D. Valibot

**Prós**: Modular, tree-shakeable, mais leve que Zod
**Contras**: Ecossistema menor, react-hook-form integration menos madura
**Decisão**: 🤔 Adiada — pode reconsiderar se bundle size virar problema

## References

- [Zod Docs](https://zod.dev/)
- [Zod + react-hook-form](https://react-hook-form.com/get-started#SchemaValidation)
- [Zod + Drizzle](https://orm.drizzle.team/docs/zod)
- [Total TypeScript Zod tutorial](https://www.totaltypescript.com/tutorials/zod)
