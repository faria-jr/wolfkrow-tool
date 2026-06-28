# ADR-0013: WebSocket para Comunicação Bidirecional

**Status**: ✅ Aceito
**Data**: 2026-06-20

## Contexto

O Wolfkrow Tool precisa de comunicação bidirecional para:

1. **PTY Terminal (CodeBurn)**: user input ↔ terminal output em tempo real
2. **Codex CLI OAuth callback**: WebSocket para OAuth flow
3. **Real-time collaboration** (futuro, v2.0)

SSE é unidirecional (server → client), não serve para esses casos.

## Decisão

**WebSocket** via `@fastify/websocket` no Worker + Next.js Route Handler como proxy.

```typescript
// apps/worker/src/pty/server.ts
import { WebSocketServer } from 'ws';
import { spawn } from 'node-pty';

export function handlePtyConnection(ws: WebSocket) {
  const pty = spawn('bash', [], {
    name: 'xterm-color',
    cols: 80,
    rows: 24,
    cwd: process.env.HOME || '/',
    env: process.env as { [key: string]: string },
  });

  // PTY output → WebSocket
  pty.onData((data) => {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({ type: 'output', data }));
    }
  });

  // WebSocket input → PTY
  ws.on('message', (raw) => {
    const msg = JSON.parse(raw.toString());

    switch (msg.type) {
      case 'input':
        pty.write(msg.data);
        break;
      case 'resize':
        pty.resize(msg.cols, msg.rows);
        break;
      case 'signal':
        pty.kill(msg.signal); // SIGINT, SIGTERM, etc
        break;
    }
  });

  // Cleanup
  ws.on('close', () => pty.kill());
  ws.on('error', () => pty.kill());
}
```

```typescript
// apps/web/app/api/pty/[id]/route.ts
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireSession();

  // Upgrade HTTP to WebSocket via Worker
  const workerWs = new WebSocket(`ws://localhost:4000/pty/${params.id}`, {
    headers: { Authorization: `Bearer ${await getJWT(session)}` },
  });

  // Bridge: browser WebSocket ↔ worker WebSocket
  // (Implementação real usa upgrade de conexão HTTP, não nested WebSocket)

  return new Response('WebSocket upgrade required', { status: 426 });
}
```

```typescript
// apps/web/lib/ws/usePty.ts
'use client';
import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';

export function usePty(sessionId: string) {
  const wsRef = useRef<WebSocket | null>(null);
  const termRef = useRef<Terminal | null>(null);

  useEffect(() => {
    const term = new Terminal({
      cursorBlink: true,
      fontFamily: 'JetBrains Mono, monospace',
      fontSize: 14,
      theme: { background: '#0a0a0a' },
    });

    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(document.getElementById('terminal')!);
    fit.fit();

    termRef.current = term;

    const ws = new WebSocket(`ws://localhost:3000/api/pty/${sessionId}`);
    wsRef.current = ws;

    ws.onopen = () => {
      term.writeln('\x1b[32mConnected\x1b[0m');
    };

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === 'output') {
        term.write(msg.data);
      }
    };

    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'input', data }));
      }
    });

    const handleResize = () => {
      fit.fit();
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            type: 'resize',
            cols: term.cols,
            rows: term.rows,
          })
        );
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      ws.close();
      term.dispose();
      window.removeEventListener('resize', handleResize);
    };
  }, [sessionId]);

  return { send: (data: string) => wsRef.current?.send(JSON.stringify({ type: 'input', data })) };
}
```

## Consequências

### Positivas

- **Bidirectional**: input + output em mesma conexão
- **Low latency**: full-duplex
- **Standard**: WebSocket API em todos browsers
- **xterm.js integration**: terminal interativo funciona perfeitamente

### Negativas

- **Mais complexo**: precisa reconnect logic
- **Proxy issues**: corporate proxies podem bloquear
- **HTTP/2 incompatível**: WebSocket usa HTTP/1.1 upgrade
- **Scaling**: stateful connections (não escala horizontalmente fácil)

### Mitigações

- Reconnect com exponential backoff
- Fallback para SSE se WebSocket bloqueado
- Single-user = scaling não é problema

## Arquitetura

```
Browser              Next.js Route Handler         Worker
   |                        |                          |
   |--WS upgrade----------->|                          |
   |                        |--WS upgrade------------->|
   |                        |                          |
   |<--WS open--------------|<--WS open----------------|
   |                        |                          |
   |--input "ls\n"--------->|--input "ls\n"---------->|
   |                        |                          |
   |<--output "file1..."----|<--output "file1..."------|
   |<--output "file2..."----|<--output "file2..."------|
   |                        |                          |
   |--resize 120x40-------->|--resize 120x40--------->|
```

Next.js Route Handler faz **WebSocket proxy** (passa conexão TCP adiante).

## Implementação Real do Proxy

```typescript
// apps/web/app/api/pty/[id]/route.ts
import { WebSocket } from 'ws';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireSession();

  // Next.js não tem upgrade nativo de WebSocket em Route Handlers
  // Solução: Next.js serve página que abre WebSocket direto para Worker

  // OU: usar custom server (não Route Handler)
  // OU: usar Edge runtime com experimental.websocket

  // Para nosso caso, browser conecta direto ao Worker via:
  // ws://localhost:4000/pty/{id}
  // com JWT no query string ou via subprotocol

  return Response.json({ error: 'Use ws://localhost:4000 directly' }, { status: 400 });
}
```

**Decisão final**: Browser conecta **diretamente ao Worker** (`ws://localhost:4000/pty/{id}`), bypassando Next.js. Next.js serve UI que abre WS direto.

## Reconnect Logic

```typescript
// apps/web/lib/ws/useWebSocket.ts
export function useWebSocket(url: string, onMessage: (msg: unknown) => void) {
  const [status, setStatus] = useState<'connecting' | 'open' | 'closed'>('connecting');
  const wsRef = useRef<WebSocket | null>(null);
  const attemptsRef = useRef(0);

  useEffect(() => {
    let cancelled = false;

    const connect = () => {
      if (cancelled) return;

      const ws = new WebSocket(url);
      wsRef.current = ws;
      setStatus('connecting');

      ws.onopen = () => {
        attemptsRef.current = 0;
        setStatus('open');
      };

      ws.onmessage = (e) => {
        try {
          onMessage(JSON.parse(e.data));
        } catch (error) {
          console.error('Invalid WS message:', error);
        }
      };

      ws.onclose = () => {
        setStatus('closed');

        // Reconnect with exponential backoff
        const delay = Math.min(1000 * 2 ** attemptsRef.current, 30000);
        attemptsRef.current++;

        setTimeout(connect, delay);
      };

      ws.onerror = () => ws.close();
    };

    connect();

    return () => {
      cancelled = true;
      wsRef.current?.close();
    };
  }, [url]);

  return { status, send: (data: unknown) => wsRef.current?.send(JSON.stringify(data)) };
}
```

## Security

```typescript
// JWT validation no Worker
wss.on('connection', async (ws, req) => {
  const token = new URL(req.url, 'http://localhost').searchParams.get('token');

  if (!token) {
    ws.close(1008, 'Missing token');
    return;
  }

  try {
    const payload = await jwtVerify(token, SECRET);
    const session = payload as { userId: string };

    // Authorization check: user can only access their own PTY sessions
    const ptySession = await ptyRepo.findById(sessionId);
    if (ptySession.userId !== session.userId) {
      ws.close(1008, 'Forbidden');
      return;
    }

    handlePtyConnection(ws);
  } catch {
    ws.close(1008, 'Invalid token');
  }
});
```

## Quando Usar

### ✅ WebSocket

- PTY terminal (CodeBurn)
- Real-time bidirectional (futuro)
- OAuth callbacks (futuro)
- Code review live (futuro)

### ✅ SSE

- Chat streaming
- Pipeline progress
- Harness rounds
- Logs live tail
- Knowledge ingest progress
- Dreaming events

## Alternativas Consideradas

### A. Socket.IO

**Prós**: Reconnect automático, rooms, broadcast
**Contras**: Protocol proprietário, mais pesado
**Decisão**: ❌ Rejeitado — WS nativo é suficiente

### B. SSE bidirecional (hack)

**Prós**: HTTP puro
**Contras**: Não é real bidirectional, hack
**Decisão**: ❌ Rejeitado — WebSocket é o padrão

### C. gRPC streaming

**Prós**: Type-safe, bidirectional
**Contras**: Browser não suporta nativamente
**Decisão**: ❌ Rejeitado

## References

- [WebSocket API](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
- [@fastify/websocket](https://github.com/fastify/fastify-websocket)
- [node-pty](https://github.com/microsoft/node-pty)
- [xterm.js](https://xtermjs.org/)
