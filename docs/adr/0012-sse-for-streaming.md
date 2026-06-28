# ADR-0012: SSE para Streaming Unidirecional

**Status**: ✅ Aceito
**Data**: 2026-06-20

## Contexto

O Wolfkrow Tool precisa de streaming em tempo real para:

1. **Chat**: tokens streamed do LLM conforme gerados
2. **Pipeline**: progresso de fases
3. **Harness**: rounds de Planner→Coder→Evaluator
4. **Logs**: live tail
5. **Dreaming**: eventos de manutenção
6. **Knowledge ingest**: progresso de chunking/embedding
7. **Voice**: chunks de TTS em streaming

No LionClaw v3, isso é feito via IPC (Electron `ipcRenderer.on`). Para web, precisamos de alternativa.

## Decisão

**Server-Sent Events (SSE)** como padrão para streaming unidirecional server → client.

```typescript
// apps/web/app/api/chat/send/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const session = await requireSession();
  const input = SendMessageInputSchema.parse(await req.json());

  const encoder = new TextEncoder();

  return new Response(
    new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of container.get(SendMessage).execute({
            ...input,
            userId: session.userId,
          })) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
          }
          controller.close();
        } catch (error) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'error', message: String(error) })}\n\n`)
          );
          controller.close();
        }
      },
    }),
    {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    }
  );
}
```

```typescript
// apps/web/lib/sse/useChatStream.ts
'use client';
import { useEffect, useRef } from 'react';
import { ChatStreamChunkSchema } from '@wolfkrow/shared-types/sse/chat-events';
import { useChatStreamStore } from '@web/lib/presentation/stores/chat-stream.store';

export function useChatStream(sessionId: string | null) {
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!sessionId) return;

    const es = new EventSource(`/api/chat/stream/${sessionId}`);
    eventSourceRef.current = es;

    es.onmessage = (e) => {
      try {
        const chunk = ChatStreamChunkSchema.parse(JSON.parse(e.data));
        useChatStreamStore.getState().appendChunk(chunk);
      } catch (error) {
        console.error('Invalid SSE chunk:', error);
      }
    };

    es.onerror = () => {
      // Reconnect logic with exponential backoff
    };

    return () => {
      es.close();
      useChatStreamStore.getState().clear();
    };
  }, [sessionId]);
}
```

## Consequências

### Positivas

- **HTTP standard**: funciona em qualquer browser moderno
- **Auto-reconnect**: EventSource reconecta automaticamente
- **Chunked transfer**: dados chegam incrementalmente
- **Type-safe**: Zod valida cada chunk
- **Next.js nativo**: ReadableStream API
- **Proxy-friendly**: HTTP/1.1 + HTTP/2

### Negativas

- **Unidirecional**: só server → client (usar WebSocket para bidirectional)
- **Browser throttling**: tab inativa pode throttlar (mitigado por Service Worker)
- **Proxy issues**: alguns corporate proxies buffering
- **Connection limit**: HTTP/1.1 limita a 6 connections por origin (HTTP/2 resolve)

### Mitigações

- Service Worker para manter conexão ativa em background
- Fallback para long-polling se SSE bloqueado
- HTTP/2 em produção (Vercel, etc)
- Heartbeat ping a cada 30s para manter conexão

## Arquitetura

```
Browser                   Next.js                    Worker
   |                         |                          |
   |--POST /api/chat/send-->|                          |
   |                         |--POST /chat/send------>|
   |                         |                          |
   |<--SSE chunk (text)-----|                          |
   |<--SSE chunk (text)-----|<--SSE chunk (text)-------|
   |<--SSE chunk (tool)-----|<--SSE chunk (tool)-------|
   |                         |                          |
   |<--SSE done-------------|<-end of stream----------|
```

Next.js Route Handler faz **proxy SSE** do Worker para o browser.

## Reconnect Logic

```typescript
// apps/web/lib/sse/useReconnect.ts
export function useReconnect(es: EventSource, onReconnect: () => void) {
  useEffect(() => {
    let reconnectAttempts = 0;

    const handleError = () => {
      es.close();

      const delay = Math.min(1000 * 2 ** reconnectAttempts, 30000);
      reconnectAttempts++;

      setTimeout(() => {
        onReconnect();
      }, delay);
    };

    es.addEventListener('error', handleError);
    return () => es.removeEventListener('error', handleError);
  }, [es, onReconnect]);
}
```

## Heartbeat

```typescript
// Next.js Route Handler
const heartbeat = setInterval(() => {
  controller.enqueue(encoder.encode(': heartbeat\n\n'));
}, 30000);

req.signal.addEventListener('abort', () => {
  clearInterval(heartbeat);
  controller.close();
});
```

## Múltiplos Tipos de Stream

| Tipo             | Endpoint                     | Schema              | Update interval |
| ---------------- | ---------------------------- | ------------------- | --------------- |
| Chat             | `/api/chat/send`             | ChatStreamChunk     | Real-time       |
| Pipeline         | `/api/pipeline/{id}/stream`  | PipelineStreamChunk | 100-500ms       |
| Harness          | `/api/harness/{id}/stream`   | HarnessStreamChunk  | 500ms-1s        |
| Logs             | `/api/logs/stream`           | LogEntry            | 100ms           |
| Dreaming         | `/api/dreaming/stream`       | DreamingEvent       | 5-30s           |
| Knowledge ingest | `/api/knowledge/{id}/stream` | IngestProgress      | 1s              |

## Event Types Padronizados

```typescript
// packages/shared-types/src/sse/base.ts
export const BaseSSEEventSchema = z.object({
  type: z.string(),
  timestamp: z.coerce.date(),
});

export const ErrorEventSchema = BaseSSEEventSchema.extend({
  type: z.literal('error'),
  message: z.string(),
  code: z.string().optional(),
});

export const DoneEventSchema = BaseSSEEventSchema.extend({
  type: z.literal('done'),
  durationMs: z.number().optional(),
  metrics: z.record(z.number()).optional(),
});
```

## Alternativas Consideradas

### A. WebSocket (bidirectional)

**Prós**: Bidirectional, full-duplex
**Contras**: Mais complexo, overkill para unidirectional
**Decisão**: ✅ Usado APENAS para PTY (bidirectional real)

### B. Long Polling

**Prós**: Funciona em qualquer lugar
**Contras**: Latência maior, overhead
**Decisão**: ❌ Rejeitado — SSE é melhor

### C. WebRTC

**Prós**: P2P, baixa latência
**Contras**: Complexo, overkill para server-client
**Decisão**: ❌ Rejeitado — não é nosso caso

### D. gRPC streaming

**Prós**: Type-safe, bidirectional
**Contras**: Não suportado em browser nativamente
**Decisão**: ❌ Rejeitado — SSE é HTTP standard

## References

- [Server-Sent Events Spec](https://html.spec.whatwg.org/multipage/server-sent-events.html)
- [MDN: EventSource](https://developer.mozilla.org/en-US/docs/Web/API/EventSource)
- [Next.js Streaming](https://nextjs.org/docs/app/building-your-application/routing/loading-ui-and-streaming)
- [ReadableStream API](https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream)
