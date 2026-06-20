# ADR-0008: Zustand para Client State Management

**Status**: ✅ Aceito
**Data**: 2026-06-20

## Contexto

O LionClaw v3 já usa Zustand mas com stores monolíticas:

- `pipeline-store.ts` (1886 linhas)
- `chat-store.ts` (611 linhas)
- `harness-store.ts`
- `knowledge-store.ts`
- `open-design-store.ts`
- `app-store.ts` (page routing)
- `auth-store.ts`

Problemas:
1. **God stores**: 1 store por domínio enorme
2. **Sem code-splitting**: tudo em 1 bundle
3. **Sem devtools optimization**: re-renders desnecessários
4. **Acoplamento**: stores conhecem IPC direto

## Decisão

**Zustand** para client state, com:
- **Stores segregadas** (não monolíticas)
- **Persist middleware** para estado persistente
- **DevTools** para debug
- **Slices pattern** para composição

Server state vai via TanStack Query (ADR-0009).

```typescript
// apps/web/lib/presentation/stores/chat-stream.store.ts
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { ChatStreamChunk } from '@wolfkrow/shared-types/sse/chat-events';

interface ChatStreamState {
  isStreaming: boolean;
  currentSessionId: string | null;
  chunks: ChatStreamChunk[];
  
  start: (sessionId: string) => void;
  appendChunk: (chunk: ChatStreamChunk) => void;
  stop: () => void;
  clear: () => void;
}

export const useChatStreamStore = create<ChatStreamState>()(
  devtools(
    persist(
      (set) => ({
        isStreaming: false,
        currentSessionId: null,
        chunks: [],
        
        start: (sessionId) => set({ isStreaming: true, currentSessionId: sessionId, chunks: [] }),
        appendChunk: (chunk) => set((state) => ({ chunks: [...state.chunks, chunk] })),
        stop: () => set({ isStreaming: false }),
        clear: () => set({ chunks: [] }),
      }),
      { name: 'wolfkrow-chat-stream' }
    ),
    { name: 'chat-stream' }
  )
);
```

## Consequências

### Positivas

- **Leve**: ~1KB runtime
- **Simples**: hooks-based, zero boilerplate
- **Performático**: selectors evitam re-renders desnecessários
- **DevTools**: Redux DevTools integration built-in
- **Persist**: middleware para localStorage
- **Code-splitting**: stores separadas = bundles menores
- **TypeScript-first**: types fortes sem ceremony

### Negativas

- **Sem time-travel** out-of-box (precisa DevTools middleware)
- **Sem middleware ecosystem** como Redux
- **Store isolation**: comunicação entre stores manual

### Mitigações

- DevTools middleware para time-travel
- Event bus para comunicação inter-stores
- Documentação clara

## Estrutura de Stores

```
apps/web/lib/presentation/stores/
├── chat-stream.store.ts        # SSE chunks
├── chat-session.store.ts       # Session metadata
├── chat-attachments.store.ts   # Upload state
├── agents.store.ts             # Optimistic UI
├── knowledge-search.store.ts   # Search filters
├── knowledge-docs.store.ts     # Document list
├── pipeline-projects.store.ts
├── pipeline-execution.store.ts # SSE progress
├── harness-projects.store.ts
├── voice.store.ts              # VAD state, recording
├── ui.store.ts                 # Modals, toasts
└── theme.store.ts              # Theme preference
```

## Padrões

### 1. Selectors Granulares

```typescript
// ❌ Ruim: re-render em qualquer mudança
const { isStreaming, chunks, currentSessionId } = useChatStreamStore();

// ✅ Bom: re-render só quando isStreaming muda
const isStreaming = useChatStreamStore((state) => state.isStreaming);
```

### 2. Actions Fora do Componente

```typescript
// ✅ Actions são parte do store
const stop = useChatStreamStore((state) => state.stop);

// ✅ Chamadas diretas fora de componentes
useChatStreamStore.getState().stop();
```

### 3. Slices para Stores Grandes

```typescript
// Para stores que crescem muito, dividir em slices
interface ChatSessionSlice { ... }
interface ChatStreamSlice { ... }

const createChatStore = (set, get) => ({
  ...createChatSessionSlice(set, get),
  ...createChatStreamSlice(set, get),
});
```

## Server State vs Client State

| Tipo | Onde mora | Quando usar |
|---|---|---|
| **Server state** | TanStack Query (cache, revalidation) | Data fetched from server (agents list, sessions) |
| **Client state** | Zustand | UI state (modals, toasts), session-only data (SSE chunks) |
| **Persistent state** | localStorage (via Zustand persist) | User preferences (theme, sidebar collapsed) |
| **Form state** | react-hook-form | Form values (transient) |

## Alternativas Consideradas

### A. Redux Toolkit

**Prós**: Maduro, devtools poderosos, time-travel
**Contras**: Verboso, mais código, bundle maior
**Decisão**: ❌ Rejeitado — Zustand é mais simples e suficiente

### B. Jotai / Recoil

**Prós**: Atomic, fine-grained reactivity
**Contras**: Mais complexo mental model
**Decisão**: ❌ Rejeitado — Zustand é mais simples para nosso caso

### C. Context API + useReducer

**Prós**: Built-in
**Contras**: Performance issues (re-renders), boilerplate
**Decisão**: ❌ Rejeitado — Zustand é mais performático

### D. MobX

**Prós**: Reactive, decorators
**Contras**: Mais opinionated, menor ecossistema
**Decisão**: ❌ Rejeitado — Zustand é mais popular em React

## References

- [Zustand Docs](https://github.com/pmndrs/zustand)
- [Zustand Best Practices](https://tkdodo.eu/blog/working-with-zustand)
- [TanStack Query vs Zustand](https://tkdodo.eu/blog/practical-react-query)
