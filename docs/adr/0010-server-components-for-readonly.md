# ADR-0010: Server Components para Read-Only Pages

**Status**: ✅ Aceito
**Data**: 2026-06-20

## Contexto

No LionClaw v3, todas as 19 páginas são Client Components (React 19 + Vite). Isso significa:

1. **Bundle JS grande**: tudo vai para o browser
2. **TTFB lento**: render só após JS carregar
3. **FCP ruim**: First Contentful Paint atrasado
4. **Interatividade desnecessária**: páginas read-only (Knowledge list, Usage stats) não precisam de JS

## Decisão

**Server Components (RSC)** como default para pages read-only. Client Components só quando necessário (interatividade, state, effects).

### Padrão de Decisão

```typescript
// ✅ Server Component (default) - read-only
// apps/web/app/(app)/agents/page.tsx
import { listAgents } from '@wolfkrow/use-cases/agents/list-agents';
import { container } from '@wolfkrow/infra/di/container';

export default async function AgentsPage() {
  const session = await requireSession();
  const agents = await container.get(ListAgents).execute({ userId: session.userId });
  
  return (
    <div>
      <h1>Agents</h1>
      <AgentList agents={agents} /> {/* Client Component para interatividade */}
    </div>
  );
}

// ✅ Client Component - interatividade
// apps/web/components/agents/AgentList.tsx
'use client';
import { useState } from 'react';

export function AgentList({ agents: initialAgents }: { agents: Agent[] }) {
  const [filter, setFilter] = useState('');
  const agents = initialAgents.filter(/* ... */);
  
  return <DataTable data={agents} />;
}
```

## Consequências

### Positivas

- **Zero JS ao browser** para pages read-only
- **TTFB melhor**: render no servidor
- **SEO-friendly**: HTML completo
- **Data fetching direto**: sem API round-trip
- **Type-safe end-to-end**: server → client props

### Negativas

- **Mental model**: "use client" boundary
- **Async components**: precisa Suspense
- **Debugging**: harder than client-only

### Mitigações

- Documentação clara em AGENT.md
- ESLint rule para detectar use client desnecessário
- Code review

## Quando Usar Server Components

### ✅ Server Component
- Read-only data display
- Database queries diretas
- Heavy computation
- SEO critical content
- Pages com pouco ou zero interactivity

**Exemplos no Wolfkrow**:
- `/knowledge` — lista de documents
- `/usage` — analytics com charts
- `/vault` — lista de secrets
- `/logs` — table de audit log
- `/memory` — lista de memories
- `/scheduler` — calendar view

### ✅ Client Component
- Interatividade (forms, modals, drag-drop)
- State local (useState, useReducer)
- Effects (useEffect, event listeners)
- Browser APIs (localStorage, Web Audio, File System Access)
- SSE streaming (EventSource)

**Exemplos**:
- `/chat` — streaming SSE + input
- `AgentFormModal` — form interativo
- `VoiceOrb` — Web Audio API
- `DataTable` — sorting/filtering
- `Command` — keyboard navigation

## Streaming SSR

```tsx
// apps/web/app/(app)/chat/page.tsx
import { Suspense } from 'react';

export default function ChatPage() {
  return (
    <div>
      <Sidebar />
      <main>
        <Suspense fallback={<ChatSkeleton />}>
          <SessionList /> {/* Server Component async */}
        </Suspense>
        <ChatView /> {/* Client Component */}
      </main>
    </div>
  );
}

async function SessionList() {
  const sessions = await getSessions(); // pode demorar
  return <SessionListItems sessions={sessions} />;
}
```

## Data Fetching Patterns

### 1. Server Components (Preferred)

```tsx
async function AgentsPage() {
  const agents = await listAgents(); // direto, sem fetch
  return <AgentList agents={agents} />;
}
```

### 2. Server Actions (Mutations)

```tsx
'use server';
export async function createAgent(input: CreateAgentInput) {
  // server-side, called from client
  await container.get(CreateAgent).execute(input);
  revalidatePath('/agents');
}
```

### 3. TanStack Query (Client Components)

```tsx
'use client';
export function AgentList() {
  const { data: agents } = useAgents(); // via TanStack Query
  return <DataTable data={agents} />;
}
```

### 4. SSE Streaming (Realtime)

```tsx
'use client';
export function ChatView() {
  useEffect(() => {
    const es = new EventSource('/api/chat/stream');
    es.onmessage = (e) => { /* ... */ };
    return () => es.close();
  }, []);
}
```

## Alternativas Consideradas

### A. Tudo Client Component (status quo)

**Prós**: Simples, tudo funciona igual
**Contras**: Bundle grande, TTFB ruim
**Decisão**: ❌ Rejeitado — perdemos benefícios do RSC

### B. Tudo Server Component

**Prós**: Bundle mínimo
**Contras**: Sem interatividade (impossível)
**Decisão**: ❌ Rejeitado — não funciona

### C. Astro (multi-framework)

**Prós**: Islands architecture, RSC-like
**Contras**: Migration complex, Next.js tem melhor ecosystem
**Decisão**: ❌ Rejeitado — Next.js é mais maduro

## References

- [Server Components RFC](https://github.com/reactjs/rfcs/blob/main/text/0188-server-components.md)
- [Next.js Server Components](https://nextjs.org/docs/app/building-your-application/rendering/server-components)
- [Composition Patterns](https://nextjs.org/docs/app/building-your-application/rendering/composition-patterns)
