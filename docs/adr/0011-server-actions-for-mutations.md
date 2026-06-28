# ADR-0011: Server Actions para Mutations

**Status**: ✅ Aceito
**Data**: 2026-06-20

## Contexto

Mutations no LionClaw v3:

1. Chamam IPC handler (string channel, untyped)
2. Payload sem validação runtime
3. Sem optimistic update
4. Sem revalidation automática
5. Error handling manual

## Decisão

**Server Actions** (React 19) para mutations simples com optimistic UI.

```typescript
// apps/web/app/(app)/agents/actions.ts
'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { container } from '@wolfkrow/infra/di/container';
import { CreateAgent } from '@wolfkrow/use-cases/agents/create-agent';
import { requireSession } from '@web/lib/auth/session';

export async function createAgent(input: CreateAgentInput) {
  const session = await requireSession();
  const useCase = container.get(CreateAgent);

  const agent = await useCase.execute({
    ...input,
    userId: session.userId,
  });

  revalidatePath('/agents');
  revalidateTag('agents');

  return agent;
}

export async function deleteAgent(id: string) {
  const session = await requireSession();
  await container.get(DeleteAgent).execute({ id, userId: session.userId });
  revalidatePath('/agents');
}
```

```tsx
// apps/web/components/agents/CreateAgentButton.tsx
'use client';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { createAgent } from '@/app/(app)/agents/actions';

export function CreateAgentButton() {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          try {
            await createAgent({ name: 'New agent', model: 'sonnet' });
            toast.success('Agent created');
          } catch (error) {
            toast.error('Failed to create agent');
          }
        });
      }}
    >
      {pending ? 'Creating...' : 'Create'}
    </Button>
  );
}
```

## Consequências

### Positivas

- **Type-safe end-to-end**: Zod input → Server Action → use-case
- **Revalidation automática**: `revalidatePath` ou `revalidateTag`
- **Optimistic UI**: `useOptimistic` hook
- **CSRF protection**: built-in via Next.js
- **Error handling**: try/catch padrão
- **Progressive enhancement**: funciona sem JS (form submit nativo)

### Negativas

- **Network overhead**: cada mutation = HTTP POST
- **Bundle size**: client component precisa do form
- **Limited**: streaming responses melhor com Route Handlers + SSE

### Mitigações

- Usar apenas para mutations simples (CRUD)
- SSE/REST API para streaming e casos complexos

## Quando Usar

### ✅ Server Actions

- Forms simples (create, update, delete)
- Mutations com 1-2 steps
- Sem streaming response
- Revalidation automática desejada

### ✅ Route Handlers (REST)

- Streaming responses (SSE, file upload/download)
- Webhooks externos
- API pública (futura)
- Casos onde precisa controle fino de HTTP

## Otimizações

### 1. useTransition para Pending State

```tsx
const [pending, startTransition] = useTransition();

startTransition(async () => {
  await createAgent(input);
});
```

### 2. useOptimistic para UI Instantâneo

```tsx
const [optimisticAgents, addOptimistic] = useOptimistic(agents, (state, newAgent: Agent) => [
  ...state,
  { ...newAgent, id: 'temp' },
]);

startTransition(async () => {
  addOptimistic(newAgent);
  await createAgent(newAgent);
});
```

### 3. Revalidation Granular

```typescript
'use server';

// Revalida path específico
revalidatePath('/agents');

// Revalida tag (qualquer page que usou fetch com essa tag)
revalidateTag('agents');

// Revalida layout (sidebar, header)
revalidateLayout('/agents');
```

## Forms Integration

```tsx
// apps/web/components/agents/AgentForm.tsx
'use client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CreateAgentInputSchema } from '@wolfkrow/shared-types/schemas/agent';
import { createAgent } from '@/app/(app)/agents/actions';

export function AgentForm() {
  const form = useForm({
    resolver: zodResolver(CreateAgentInputSchema),
    defaultValues: { name: '', model: 'sonnet', effort: 'medium' },
  });

  async function onSubmit(data: CreateAgentInput) {
    const result = await createAgent(data);
    if (result.success) {
      toast.success('Agent created');
      form.reset();
    } else {
      toast.error(result.error);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>{/* fields */}</form>
    </Form>
  );
}
```

## Error Handling

```typescript
'use server';

export type ActionResult<T> = { success: true; data: T } | { success: false; error: string };

export async function createAgent(input: CreateAgentInput): Promise<ActionResult<Agent>> {
  const session = await requireSession();

  try {
    const agent = await container.get(CreateAgent).execute({ ...input, userId: session.userId });
    revalidatePath('/agents');
    return { success: true, data: agent };
  } catch (error) {
    if (error instanceof ValidationError) {
      return { success: false, error: error.message };
    }
    logger.error({ err: error, userId: session.userId }, 'failed to create agent');
    return { success: false, error: 'Internal server error' };
  }
}
```

## Alternativas Consideradas

### A. Route Handlers (REST API)

**Prós**: HTTP standard, controle total, streaming
**Contras**: Mais boilerplate, sem optimistic UI built-in
**Decisão**: ✅ Aceito para casos complexos (streaming, file upload)

### B. tRPC

**Prós**: Type-safe RPC, end-to-end types
**Contras**: Mais setup, vendor lock-in
**Decisão**: 🤔 Adiada — pode reconsiderar se complexidade aumentar

### C. GraphQL

**Prós**: Single endpoint, typed schema
**Contras**: Overhead para nosso caso
**Decisão**: ❌ Rejeitado — overkill

## References

- [Server Actions RFC](https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations)
- [useTransition](https://react.dev/reference/react/useTransition)
- [useOptimistic](https://react.dev/reference/react/useOptimistic)
- [revalidatePath/revalidateTag](https://nextjs.org/docs/app/api-reference/functions/revalidatePath)
