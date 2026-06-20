# ADR-0014: Worker Node.js Process Separado

**Status**: ✅ Aceito
**Data**: 2026-06-20

## Contexto

O Wolfkrow Tool precisa rodar várias coisas que **não cabem no Next.js**:

1. **MCP servers spawnados** (19 subprocessos stdio)
2. **Telegram bot polling** (long-running)
3. **Scheduler cron** (setInterval infinito)
4. **Whisper local** (subprocess + modelos grandes)
5. **ffmpeg** (subprocess)
6. **node-pty** (terminal instances)
7. **Dreaming engine** (idle detection)
8. **Memory pipeline** (compaction background)
9. **Codex CLI** (OAuth + subprocess)

Next.js Route Handlers são **stateless e efêmeros** (cada request = novo handler). Precisamos de processo **long-running** com state.

## Decisão

**Worker Node.js process separado** rodando em `localhost:4000`.

```
Browser → Next.js (3000) → Worker (4000) → SQLite + Keychain + MCPs
```

### Estrutura do Worker

```typescript
// apps/worker/src/index.ts
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { handleChatStream } from './ai/orchestrator';
import { handlePtyConnection } from './pty/server';
import { mcpManager } from './mcp/manager';
import { telegramBridge } from './telegram/bridge';
import { scheduler } from './scheduler/runner';
import { dreamingEngine } from './dreaming/engine';
import { logger } from './logger';

async function main() {
  // 1. Init DB
  await initDatabase();
  
  // 2. Start MCPs
  await mcpManager.startAll();
  
  // 3. Start Telegram bot
  await telegramBridge.start();
  
  // 4. Start scheduler
  scheduler.start();
  
  // 5. Start dreaming engine
  dreamingEngine.start();
  
  // 6. HTTP server (chat, MCP control, REST API)
  const httpServer = createServer(handleHttp);
  
  // 7. WebSocket server (PTY)
  const wss = new WebSocketServer({ server: httpServer, path: '/pty' });
  wss.on('connection', handlePtyConnection);
  
  httpServer.listen(4000, () => {
    logger.info('Worker listening on :4000');
  });
  
  // 8. Graceful shutdown
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

async function shutdown() {
  logger.info('Shutting down...');
  await mcpManager.stopAll();
  await telegramBridge.stop();
  scheduler.stop();
  dreamingEngine.stop();
  process.exit(0);
}

main().catch((error) => {
  logger.fatal({ err: error }, 'Worker failed to start');
  process.exit(1);
});
```

## Consequências

### Positivas

- **Long-running state**: scheduler, dreaming, MCPs persistem
- **Subprocess management**: spawn/kill/restart limpo
- **WebSocket server**: PTY, Codex OAuth
- **Resource isolation**: Worker crash não derruba Next.js
- **Independent scaling**: pode escalar Worker separado (futuro)
- **Clean shutdown**: SIGTERM cleanup

### Negativas

- **Mais complexo**: 2 processos para gerenciar
- **Latência extra**: Next.js → Worker = +1-5ms
- **Dev setup**: precisa rodar ambos (`pnpm dev` paralelo)

### Mitigações

- Turborepo `dev` task com `concurrently`
- Scripts de inicialização (Electron wrapper ou shell script)
- Documentação clara

## Lifecycle

### Boot Sequence

```
1. Worker process starts (node apps/worker/dist/index.js)
2. Init DB (Drizzle migrations applied)
3. Load YAML seed agents (.wolfkrow/agents/*.yaml)
4. Start MCP manager (spawn 19 MCPs)
5. Start Telegram bot (if configured)
6. Start scheduler (parse cron tasks from DB)
7. Start dreaming engine (idle detection)
8. HTTP server listening on :4000
9. WebSocket server on /pty
10. Health check endpoint on /health
```

### Shutdown Sequence

```
1. SIGTERM received
2. Stop accepting new HTTP/WS connections
3. Stop scheduler (no new tasks)
4. Stop dreaming engine
5. Stop Telegram bot
6. Stop MCPs (graceful shutdown each)
7. Close HTTP server
8. Close WebSocket server
9. Close DB connection
10. Process exit 0
```

## Comunicação Next.js ↔ Worker

### REST API (HTTP)

```typescript
// Worker
if (req.url === '/chat/send' && req.method === 'POST') {
  const body = await readBody(req);
  res.writeHead(200, { 'Content-Type': 'text/event-stream' });
  await handleChatStream(body, (chunk) => {
    res.write(`data: ${JSON.stringify(chunk)}\n\n`);
  });
  res.end();
}
```

### WebSocket

```typescript
// Worker
wss.on('connection', (ws, req) => {
  const url = new URL(req.url!, `http://${req.headers.host}`);
  const sessionId = url.pathname.split('/').pop();
  handlePtyConnection(ws, sessionId);
});
```

### Auth

```typescript
// Worker middleware
async function authenticate(req: IncomingMessage): Promise<{ userId: string } | null> {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return null;
  
  try {
    const payload = await jwtVerify(auth.slice(7), SHARED_SECRET);
    return { userId: payload.sub as string };
  } catch {
    return null;
  }
}
```

## Dev Workflow

```json
// package.json raiz
{
  "scripts": {
    "dev": "concurrently -k -n web,worker -c blue,green \"pnpm dev:web\" \"pnpm dev:worker\"",
    "dev:web": "pnpm --filter web dev",
    "dev:worker": "pnpm --filter worker dev",
    "build": "pnpm turbo build",
    "start": "concurrently -k -n web,worker \"pnpm start:web\" \"pnpm start:worker\"",
    "start:web": "pnpm --filter web start",
    "start:worker": "pnpm --filter worker start"
  }
}
```

## Production Deployment

### Modo A: PWA + Worker (browser opens localhost:3000)

```bash
# User runs:
pnpm start

# Spawns:
# - Next.js production server (localhost:3000)
# - Worker (localhost:4000)
# - Browser opens http://localhost:3000
```

### Modo B: Electron Wrapper (systray + hotkey)

```typescript
// apps/wrapper/src/main.ts (Electron)
import { spawn } from 'child_process';

// Spawn Next.js + Worker as child processes
const nextProcess = spawn('node', ['apps/web/server.js']);
const workerProcess = spawn('node', ['apps/worker/dist/index.js'], {
  detached: true,
});

// Open Electron window pointing to localhost:3000
mainWindow.loadURL('http://localhost:3000');
```

### Modo C: Native binary (pkg)

```bash
# Build single binary
npx pkg apps/wrapper/dist/main.js --targets node20-macos-arm64

# User runs:
./wolfkrow-tool

# Internally spawns:
# - bundled Next.js server
# - bundled Worker
# - opens browser
```

## Modules do Worker

```
apps/worker/src/
├── ai/                    # AI providers (4 SDKs)
│   ├── claude-agent-sdk/
│   ├── claude-compat-sdk/
│   ├── codex-sdk/
│   ├── lion-sdk/
│   ├── agent-runtime/
│   └── orchestrator.ts
├── mcp/                   # MCP manager (19 servers)
│   ├── manager.ts
│   ├── bridge.ts
│   └── catalog.ts
├── voice/                 # STT + TTS
│   ├── whisper.ts
│   ├── elevenlabs.ts
│   ├── cartesia.ts
│   └── streaming-tts.ts
├── pty/                   # CodeBurn terminal
│   └── server.ts
├── telegram/              # Bot bridge
│   └── bridge.ts
├── scheduler/             # Cron runner
│   ├── runner.ts
│   ├── tasks.ts
│   └── activities.ts
├── dreaming/              # Idle maintenance
│   ├── gate.ts
│   └── turn-engine.ts
├── memory/                # Compaction background
│   └── pipeline.ts
├── harness/               # Planner→Coder→Evaluator
│   ├── engine.ts
│   ├── planner.ts
│   ├── evaluator.ts
│   └── prompts.ts
├── pipeline/              # BuildPlan
│   ├── engine.ts
│   ├── open-design-manager.ts
│   └── phases/
├── enrich/                # Validator→Enricher
│   └── engine.ts
├── knowledge/             # RAG
│   ├── engine.ts
│   ├── benchmark.ts
│   └── graph-ingest.ts
├── secrets/               # keytar
│   └── vault.ts
├── embeddings/            # Anthropic API
│   └── anthropic.ts
├── doc-parsers/           # PDF, DOCX, CSV, XLSX
│   ├── pdf.ts
│   ├── docx.ts
│   ├── csv.ts
│   └── xlsx.ts
├── db/                    # Drizzle client
│   ├── client.ts
│   └── migrate.ts
├── seed-agents/           # YAML loader
│   ├── loader.ts
│   └── schema.ts
├── routes/                # HTTP routes
│   ├── chat.ts
│   ├── mcp.ts
│   ├── scheduler.ts
│   ├── knowledge.ts
│   └── ...
├── server.ts              # HTTP + WS
├── index.ts               # Entry point
└── logger.ts              # Pino
```

## Alternativas Consideradas

### A. Tudo dentro do Next.js (Route Handlers)

**Prós**: Mais simples, 1 processo
**Contras**: Stateless, não roda long-running, não spawn subprocessos
**Decisão**: ❌ Rejeitado — não atende requisitos

### B. Serverless (AWS Lambda, Cloudflare Workers)

**Prós**: Auto-scaling
**Contras**: Não é self-hosted, cold starts, não roda MCPs
**Decisão**: ❌ Rejeitado — single-user self-hosted

### C. Background jobs em queue (BullMQ, etc)

**Prós**: Robust, retry logic
**Contras**: Overhead, single-user não precisa
**Decisão**: ❌ Rejeitado — overkill

### D. Sidecar container (Docker)

**Prós**: Isolamento, reproduzível
**Contras**: Requer Docker instalado, overhead
**Decisão**: 🤔 Considerado para v2.0 cloud mode

## References

- [Fastify](https://fastify.dev/)
- [@fastify/websocket](https://github.com/fastify/fastify-websocket)
- [concurrently](https://github.com/open-cli-tools/concurrently)
- [Graceful Shutdown](https://expressjs.com/en/advanced/healthcheck-graceful-shutdown.html)
