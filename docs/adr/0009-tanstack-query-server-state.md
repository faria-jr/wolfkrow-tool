# ADR-0009: TanStack Query para Server State

**Status**: ✅ Aceito
**Data**: 2026-06-20

## Contexto

No LionClaw v3, server state (data fetched from main process via IPC) é gerenciado em Zustand stores manualmente. Problemas:

1. **Sem cache**: cada fetch rebate no main process
2. **Sem revalidation**: dados stale até refresh manual
3. **Sem dedup**: múltiplos componentes fetchando mesmo dado
4. **Sem retry**: falha de IPC = erro imediato
5. **Sem optimistic updates**: UI bloqueia esperando response

## Decisão

**TanStack Query (React Query) v5** para server state.

```typescript
// apps/web/lib/presentation/queries/use-agents.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchAgents, createAgent } from '@web/lib/api-client/agents';

export function useAgents() {
  return useQuery({
    queryKey: ['agents'],
    queryFn: fetchAgents,
    staleTime: 5 * 60 * 1000, // 5min
    gcTime: 30 * 60 * 1000, // 30min
  });
}

export function useCreateAgent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createAgent,
    onMutate: async (newAgent) => {
      // Optimistic update
      await queryClient.cancelQueries({ queryKey: ['agents'] });
      const previous = queryClient.getQueryData(['agents']);
      queryClient.setQueryData(['agents'], (old: Agent[]) => [...old, { ...newAgent, id: 'temp' }]);
      return { previous };
    },
    onError: (err, newAgent, context) => {
      // Rollback
      queryClient.setQueryData(['agents'], context?.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] });
    },
  });
}
```

## Consequências

### Positivas

- **Cache automático**: 5min stale time por padrão
- **Revalidation**: background refetch on focus, mount, interval
- **Deduplication**: múltiplos componentes = 1 fetch
- **Retry**: exponential backoff automático (3 tentativas)
- **Optimistic updates**: UI responsiva
- **Garbage collection**: cache limpo após 30min sem uso
- **TypeScript first**: tudo tipado
- **DevTools**: React Query Devtools para debug

### Negativas

- **Bundle size**: ~13KB gzip
- **Learning curve**: mental model diferente
- **Setup**: provider + client config

### Mitigações

- Provider wrapper em layout root
- QueryClient configurado uma vez
- Hooks customizados escondem complexidade

## Estrutura

```
apps/web/lib/presentation/queries/
├── use-agents.ts
├── use-skills.ts
├── use-mcps.ts
├── use-knowledge-docs.ts
├── use-sessions.ts
├── use-scheduler-tasks.ts
├── use-pipeline-projects.ts
├── use-harness-projects.ts
├── use-vault-secrets.ts
└── use-usage-stats.ts
```

## Configuração

```typescript
// apps/web/lib/query-client.ts
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 1,
    },
  },
});
```

```tsx
// apps/web/app/layout.tsx
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <QueryClientProvider client={queryClient}>
          {children}
          <ReactQueryDevtools initialIsOpen={false} />
        </QueryClientProvider>
      </body>
    </html>
  );
}
```

## Estratégias por Tipo de Data

| Tipo              | staleTime        | gcTime | refetchOnWindowFocus |
| ----------------- | ---------------- | ------ | -------------------- |
| Agents list       | 5min             | 30min  | false                |
| Skills list       | 5min             | 30min  | false                |
| Sessions          | 30s              | 5min   | true                 |
| Messages          | 0 (sempre fresh) | 5min   | true                 |
| Knowledge docs    | 5min             | 30min  | false                |
| Scheduler tasks   | 1min             | 10min  | true                 |
| Pipeline projects | 30s              | 5min   | true                 |
| Vault secrets     | 0 (sempre fresh) | 1min   | false                |
| Usage stats       | 1min             | 10min  | true                 |

## SSE Integration

Para streaming data (chat, pipeline), TanStack Query não é ideal. Usar:

- **EventSource API direto** + Zustand store
- OU **TanStack Query com streamedQuery** (experimental)

```typescript
// Chat streaming (não usa TanStack Query)
const eventSource = new EventSource('/api/chat/stream/session-123');
eventSource.onmessage = (e) => {
  const chunk = ChatStreamChunkSchema.parse(JSON.parse(e.data));
  useChatStreamStore.getState().appendChunk(chunk);
};
```

## Alternativas Consideradas

### A. SWR

**Prós**: Similar ao TanStack Query, mais simples
**Contras**: Menos features, menos popular
**Decisão**: ❌ Rejeitado — TanStack Query é mais poderoso

### B. Apollo Client (GraphQL)

**Prós**: Maduro, cache avançado
**Contras**: Requer backend GraphQL (não temos)
**Decisão**: ❌ Rejeitado — usamos REST + SSE

### C. RTK Query

**Prós**: Integrado com Redux
**Contras**: Acopla com Redux, não usamos Redux
**Decisão**: ❌ Rejeitado — Zustand + TanStack Query é melhor combo

### D. Manual fetch + Zustand

**Prós**: Zero deps
**Contras**: Reimplementar cache, retry, dedup, revalidation
**Decisão**: ❌ Rejeitado — TanStack Query resolve tudo

## References

- [TanStack Query Docs](https://tanstack.com/query/latest)
- [Practical React Query](https://tkdodo.eu/blog/practical-react-query)
- [Server State vs Client State](https://tkdodo.eu/blog/practical-react-query#1-the-two-states)
