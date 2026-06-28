# Wolfkrow Tool — ARCHITECTURE.md

> Arquitetura técnica completa do Wolfkrow Tool. Para decisões específicas, consulte os ADRs em [`docs/adr/`](./adr/).

---

## 1. Visão Arquitetural

Wolfkrow Tool é um **sistema distribuído single-machine** composto por 3 processos independentes que se comunicam via HTTP, SSE e WebSocket:

```
┌──────────────────────────────────────────────────────────────────┐
│                    BROWSER (Chrome/Edge/Firefox)                 │
│                                                                  │
│  Next.js 15 App Router (RSC + Client Components)                │
│  - shadcn/ui + Tailwind v4                                      │
│  - Zustand (client state) + TanStack Query (server state)       │
│  - Web Audio API (VAD, TTS playback)                            │
│  - Service Worker (PWA offline shell)                           │
│                                                                  │
│  Conecta a: http://localhost:3000                               │
└──────────────────┬───────────────────────────────────────────────┘
                   │ HTTP / SSE / WebSocket
                   │
┌──────────────────▼───────────────────────────────────────────────┐
│              NEXT.JS 15 PRODUCTION SERVER (Node.js)              │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Server Components (RSC) — read-only, zero JS to browser │ │
│  └────────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Route Handlers (Node runtime)                             │ │
│  │  - /api/auth/*  → bcrypt + JWT cookies                    │ │
│  │  - /api/chat/*  → SSE streaming proxy                     │ │
│  │  - /api/agents/* → CRUD via Drizzle                       │ │
│  │  - /api/knowledge/* → multipart upload proxy              │ │
│  │  - /api/pty/[id] → WebSocket upgrade                      │ │
│  │  - /api/health → liveness probe                           │ │
│  └────────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Server Actions — mutations simples com optimistic UI     │ │
│  └────────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Middleware — auth gate, rate limit, CORS                  │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  Acessa:                                                          │
│  - SQLite local (.wolfkrow/data/wolfkrow.db) via Drizzle        │
│  - Worker HTTP API (http://localhost:4000)                       │
│                                                                  │
│  Conecta a: localhost:4000                                       │
└──────────────────┬───────────────────────────────────────────────┘
                   │ HTTP / WebSocket (interno)
                   │
┌──────────────────▼───────────────────────────────────────────────┐
│                  WORKER NODE.JS (long-running)                    │
│                                                                  │
│  Fastify HTTP Server (port 4000) + WebSocket Server                      │
│                                                                  │
│  Modules:                                                         │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ ai/                                                      │ │
│  │  - claude-agent-sdk  (Anthropic)                          │ │
│  │  - claude-compat-sdk (Anthropic + custom endpoint)        │ │
│  │  - codex-sdk         (OpenAI Codex CLI via OAuth)        │ │
│  │  - lion-sdk          (multi-provider: Ollama, OpenAI,    │ │
│  │                        Google, Z.ai, custom)              │ │
│  │  - ai-providers      (7 providers: anthropic, claude-agent,│ │
│  │                        codex, lion, openrouter,            │ │
│  │                        openai-compat, claude-compat)       │ │
│  │  - orchestrator      (strategy + queue + permission)     │ │
│  └────────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ mcp/                                                     │ │
│  │  - manager    (spawn MCPs stdio: 6 built-in + catalog)    │ │
│  │  - bridge     (JSON-RPC stdio)                            │ │
│  │  - catalog    (registry)                                  │ │
│  └────────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ voice/                                                   │ │
│  │  - whisper   (local whisper.cpp subprocess)              │ │
│  │  - elevenlabs (HTTP)                                      │ │
│  │  - cartesia  (WebSocket)                                  │ │
│  │  - streaming-tts                                          │ │
│  └────────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ pty/ (node-pty + WebSocket)                               │ │
│  │ scheduler/ (cron-parser + setInterval)                    │ │
│  │ telegram/ (node-telegram-bot-api polling)                │ │
│  │ dreaming/ (idle maintenance)                              │ │
│  │ memory/ (compaction background)                           │ │
│  │ harness/ (Planner→Coder→Evaluator loop)                  │ │
│  │ pipeline/ (BuildPlan multi-stage + open-design-manager)  │ │
│  │ enrich/ (Validator→Enricher)                              │ │
│  │ knowledge/ (ingest + embed + search + benchmark)          │ │
│  │ secrets/ (keytar OS keychain)                             │ │
│  │ db/ (Drizzle client + migrations)                         │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  Spawns:                                                         │
│  - 6 built-in MCP servers + planned catalog                      │
│  - whisper.cpp subprocess                                        │
│  - ffmpeg subprocess                                             │
│  - Codex CLI subprocess                                          │
│  - node-pty instances                                            │
│                                                                  │
│  Acessa:                                                          │
│  - SQLite local (read/write)                                     │
│  - Keychain (keytar)                                             │
│  - Filesystem (.wolfkrow/*)                                      │
│  - Internet (Anthropic API, OpenAI, Google, etc)                │
└──────────────────────────────────────────────────────────────────┘
                   │
                   ├──▶ SQLite (.wolfkrow/data/wolfkrow.db)
                   ├──▶ Keychain (OS keychain via keytar)
                   ├──▶ Filesystem (.wolfkrow/{agents,skills,...})
                   └──▶ Vendor binaries (whisper.cpp, ffmpeg, codex)
```

---

## 2. Camadas da Aplicação

### 2.1 Presentation Layer (`apps/web/`)

**Responsabilidades**:

- Renderizar UI (Server + Client Components)
- Capturar input do user
- Chamar APIs (Server Actions, fetch, SSE, WebSocket)
- State management local (Zustand)
- Server state cache (TanStack Query)

**Tecnologias**:

- Next.js 15 (App Router)
- React 19
- shadcn/ui (49+ componentes)
- Tailwind CSS v4
- Zustand
- TanStack Query
- Server Components (RSC) para read-only
- Client Components para interactivity

**Estrutura**:

```
apps/web/
├── app/
│   ├── (auth)/              # Login, onboarding, unlock
│   ├── (app)/               # Authenticated routes
│   │   ├── chat/
│   │   ├── agents/
│   │   ├── knowledge/
│   │   └── ...
│   ├── api/                 # Route Handlers (Node runtime)
│   │   ├── auth/
│   │   ├── chat/
│   │   └── ...
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── ui/                  # shadcn/ui
│   ├── chat/
│   ├── agents/
│   └── ...
├── lib/
│   ├── presentation/        # hooks, stores (Zustand)
│   ├── sse/                 # SSE client utils
│   ├── ws/                  # WebSocket client utils
│   └── utils/
└── middleware.ts            # auth gate + rate limit
```

### 2.2 Application Layer (`packages/use-cases/`)

**Responsabilidades**:

- Orquestrar domain entities para resolver use cases
- Transações (multi-step operations)
- Validação de input (Zod)
- Publicação de domain events

**Tecnologias**:

- TypeScript strict
- Zod (validation)
- Inversify (DI container)
- EventEmitter (domain events)

**Exemplo**:

```typescript
// packages/use-cases/src/chat/SendMessage.ts
@injectable()
export class SendMessage {
  constructor(
    @inject('AgentRepo') private agentRepo: AgentRepo,
    @inject('SessionRepo') private sessionRepo: SessionRepo,
    @inject('MessageRepo') private messageRepo: MessageRepo,
    @inject('AIProviderFactory') private providers: AIProviderFactory,
    @inject('EventBus') private events: EventBus
  ) {}

  async execute(input: SendMessageInput): AsyncIterable<StreamChunk> {
    const agent = await this.agentRepo.findById(input.agentId);
    if (!agent) throw new AgentNotFoundError(input.agentId);

    const session = await this.sessionRepo.getOrCreate(input.sessionId, agent);
    const userMessage = Message.createUser(input.content, input.attachments);
    await this.messageRepo.save(session.id, userMessage);
    this.events.publish(new MessageSentEvent(session.id, userMessage.id));

    const provider = this.providers.forRuntime(agent.runtime);
    const prompt = agent.buildPrompt(session, userMessage);

    for await (const chunk of provider.query(prompt, { stream: true })) {
      if (chunk.type === 'text') {
        // Accumulate in session
      }
      yield chunk;
    }

    await this.sessionRepo.update(session.id, { lastActivity: new Date() });
  }
}
```

### 2.3 Domain Layer (`packages/domain/`)

**Responsabilidades**:

- Pure business entities
- Value objects (imutáveis)
- Domain services (pure logic)
- Domain events
- Repository interfaces (ports)

**Tecnologias**:

- TypeScript strict
- Zero dependências externas (exceto Zod para validação leve)

**Regras**:

- Não importa nada de infra ou presentation
- Não conhece SQLite, HTTP, React, etc
- Lógica pura (testes sem mocks)

**Estrutura**:

```
packages/domain/src/
├── entities/
│   ├── agent.ts
│   ├── session.ts
│   ├── message.ts
│   ├── knowledge/
│   │   ├── document.ts
│   │   └── chunk.ts
│   └── ...
├── value-objects/
│   ├── model-id.ts
│   ├── tool-name.ts
│   └── ...
├── services/
│   ├── pricing-calculator.ts
│   ├── token-estimator.ts
│   └── permission-resolver.ts
├── events/
│   ├── message-sent.ts
│   ├── agent-created.ts
│   └── ...
└── repos/                # Interfaces (ports)
    ├── agent-repo.ts
    └── ...
```

### 2.4 Infrastructure Layer (`packages/infra/`)

**Responsabilidades**:

- Implementar repository interfaces (Drizzle adapters)
- AI providers (Strategy pattern)
- External services (Telegram, ElevenLabs, Google, etc)
- SQLite + Drizzle client
- Migrations

**Tecnologias**:

- Drizzle ORM
- better-sqlite3 + sqlite-vec
- @anthropic-ai/claude-agent-sdk
- voyageai HTTP API (voyage-3 embeddings, 1024 dims) — ADR-0028
- @google/genai (Vertex AI)
- node-telegram-bot-api
- keytar
- pino

**Estrutura**:

```
packages/infra/src/
├── db/
│   ├── schema/           # Drizzle schema (30+ tables)
│   ├── migrations/       # drizzle-kit generated
│   └── client.ts
├── repos/                # Drizzle repos (adapters)
│   ├── drizzle-agent-repo.ts
│   ├── in-memory-agent-repo.ts (tests)
│   └── ...
├── ai-providers/         # Strategy pattern
│   ├── claude-provider.ts
│   ├── codex-provider.ts
│   ├── lion-provider.ts
│   ├── openai-compat-provider.ts
│   └── factory.ts
├── embeddings/
│   └── voyage-embedder.ts
├── secrets/
│   └── keytar-adapter.ts
├── doc-parsers/
│   ├── pdf.ts
│   ├── docx.ts
│   ├── csv.ts
│   └── xlsx.ts
└── external/
    ├── telegram.ts
    ├── elevenlabs.ts
    ├── cartesia.ts
    ├── google-calendar.ts
    └── ...
```

---

## 3. Comunicação Entre Camadas

### 3.1 Browser ↔ Next.js

**REST** (HTTP/1.1 ou HTTP/2):

```typescript
// Browser → Next.js
fetch('/api/agents', { method: 'POST', body: JSON.stringify(agent) });
```

**Server Actions** (React 19):

```typescript
'use server';
export async function createAgent(input: CreateAgentInput) {
  const session = await requireSession();
  const useCase = container.get(CreateAgent);
  return useCase.execute({ ...input, userId: session.userId });
}
```

**SSE** (Server-Sent Events):

```typescript
// Browser
const eventSource = new EventSource('/api/chat/stream/session-123');
eventSource.onmessage = (e) => {
  const chunk = JSON.parse(e.data);
  // dispatch to store
};
```

**WebSocket**:

```typescript
// Browser
const ws = new WebSocket('ws://localhost:3000/api/pty/session-123');
ws.onmessage = (e) => {
  /* terminal data */
};
ws.send(JSON.stringify({ type: 'input', data: 'ls\n' }));
```

### 3.2 Next.js ↔ Worker

**HTTP proxy** (Next.js Route Handler):

```typescript
// apps/web/app/api/chat/send/route.ts
export async function POST(req: NextRequest) {
  const body = await req.json();

  return new Response(
    new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        await forwardToWorker({
          method: 'POST',
          path: '/chat/send',
          body,
          onChunk: (chunk) => {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
          },
        });
        controller.close();
      },
    }),
    { headers: { 'Content-Type': 'text/event-stream' } }
  );
}
```

**Worker server**:

```typescript
// apps/worker/src/server.ts
import { createServer } from 'http';
import { handleChatStream } from './ai/orchestrator';
import { handlePty } from './pty/server';

const httpServer = createServer(async (req, res) => {
  if (req.url === '/chat/send' && req.method === 'POST') {
    const body = await readBody(req);
    res.writeHead(200, { 'Content-Type': 'text/event-stream' });
    await handleChatStream(body, (chunk) => res.write(`data: ${JSON.stringify(chunk)}\n\n`));
    res.end();
  }
});

const wss = new WebSocketServer({ server: httpServer, path: '/pty' });
wss.on('connection', handlePty);

httpServer.listen(4000);
```

---

## 4. Fluxos Críticos

### 4.1 Chat Send Message

```
1. User digita mensagem em ChatPage (Client Component)
2. handleSend() chama Server Action sendMessage()
3. Server Action valida input com Zod
4. Server Action chama use-case SendMessage.execute()
5. SendMessage:
   a. Busca Agent via AgentRepo
   b. Cria/recupera Session
   c. Persiste User Message
   d. Seleciona AI Provider (Strategy)
   e. Stream chunks via SSE
6. Para cada chunk:
   a. Persiste em MessageRepo (parcial)
   b. Publica MessageChunkEvent no EventBus
   c. Yield chunk para o Server Action
7. Server Action retorna ReadableStream (SSE)
8. Browser recebe chunks via EventSource
9. Zustand store atualiza state
10. React re-renderiza com novo conteúdo
11. Quando stream termina:
    a. Worker salva assistant message final
    b. Session.lastActivity atualizado
    c. Title generation dispara (background)
    d. Compaction check (se context > threshold)
```

### 4.2 Knowledge Ingest

```
1. User drop files em UploadDropZone (Client Component)
2. Files enviados via multipart para /api/knowledge/ingest
3. Route Handler:
   a. Valida session + files (size, type)
   b. Salva files em .wolfkrow/uploads/{date}/{hash}.{ext}
   c. Chama Worker: POST /knowledge/ingest
4. Worker:
   a. Para cada file:
      - Parse via doc-parsers (pdf-parse, mammoth, etc)
      - Chunk semantically (Markdown-aware)
      - Gera embeddings via Voyage AI API (voyage-3, 1024 dims)
      - Salva chunks em knowledge_chunks (sqlite-vec)
   b. Atualiza document status (processing → ready)
   c. Publica IngestCompletedEvent
5. Worker retorna para Next.js
6. Next.js retorna para browser
7. Browser atualiza UI com lista de documents
```

### 4.3 Harness Round

```
1. User inicia Harness com SPEC.md
2. Worker cria HarnessProject no DB
3. Planner decompõe SPEC em sprints + features
4. Para cada sprint:
   a. Coder implementa features (loop)
   b. Para cada round:
      - Coder: Read/Write/Edit/Bash
      - Mensagens streamed via SSE
      - Métricas coletadas (tokens, cost, duration)
      - Round salvo em harness_rounds
   c. Evaluator valida contra acceptance criteria
   d. Se passou → próxima feature
   e. Se falhou → feedback para Coder (max 5 rounds)
5. Sprint completa → próxima
6. Métricas agregadas em harness_project_metrics
7. UI mostra progresso via SSE
```

---

## 5. Banco de Dados

### 5.1 Schema Overview

**40+ tabelas** distribuídas em domínios:

| Domínio   | Tabelas                                                                   |
| --------- | ------------------------------------------------------------------------- |
| Auth      | users, totp_secrets, sessions, audit_log                                  |
| Chat      | chat_sessions, chat_messages, chat_attachments                            |
| Agents    | agents, agent_sync_history                                                |
| Skills    | skills                                                                    |
| MCPs      | mcp_servers, mcp_tool_registry                                            |
| Scheduler | scheduled_tasks, task_runs, task_activities                               |
| Knowledge | knowledge_documents, knowledge_chunks, knowledge_benchmarks               |
| Memory    | semantic_memories, daily_summaries, compaction_log                        |
| Harness   | harness_projects, harness_sprints, harness_rounds                         |
| Pipeline  | pipeline_projects, pipeline_phases, pipeline_messages, pipeline_artifacts |
| Workflow  | workflow_runs                                                             |
| Enrich    | enrich_sessions, enrich_messages                                          |
| Vault     | secrets_metadata (keytar para values)                                     |
| Settings  | settings, channels                                                        |
| Tasks     | tasks, task_executions                                                    |
| Usage     | token_usage                                                               |

### 5.2 Drizzle Schema Example

```typescript
// packages/infra/src/db/schema/agents.ts
import { sqliteTable, text, integer, boolean } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const agents = sqliteTable('agents', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id),
  name: text('name').notNull(),
  description: text('description'),
  model: text('model').notNull(),
  effort: text('effort', { enum: ['low', 'medium', 'high', 'max'] }).notNull(),
  thinking: boolean('thinking').default(false),
  thinkingBudget: integer('thinking_budget'),
  maxTurns: integer('max_turns').default(80),
  allowedTools: text('allowed_tools', { mode: 'json' }).$type<string[]>(),
  mcpServers: text('mcp_servers', { mode: 'json' }).$type<string[]>(),
  isActive: boolean('is_active').default(true),
  skills: text('skills', { mode: 'json' }).$type<string[]>(),
  runtime: text('runtime').notNull(), // cloud, local, codex, external
  squad: text('squad'), // harness, workflow, enrich, custom
  systemPrompt: text('system_prompt'),
  metadata: text('metadata', { mode: 'json' }).$type<Record<string, unknown>>(),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export const agentSyncHistory = sqliteTable('agent_sync_history', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  syncedAgentIds: text('synced_agent_ids', { mode: 'json' }).$type<string[]>(),
  sourceOrchestrator: text('source_orchestrator').notNull(),
  diff: text('diff', { mode: 'json' }).$type<Record<string, unknown>>(),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});
```

---

## 6. Segurança

### 6.1 Threat Model

| Threat                   | Mitigation                                                          |
| ------------------------ | ------------------------------------------------------------------- |
| XSS no chat              | React escapa por default; dangerouslySetInnerHTML proibido (ESLint) |
| CSRF                     | SameSite=Strict cookies + CSRF tokens em Server Actions             |
| SQL Injection            | Drizzle ORM com prepared statements                                 |
| Path Traversal           | Validação de paths em upload; sandbox em `.wolfkrow/`               |
| Secrets em logs          | Pino redact; keytar nunca loga value                                |
| Browser cache de secrets | httpOnly + Secure cookies; nunca localStorage                       |
| Auth bypass              | Middleware auth gate em todas routes (exceto /login)                |
| Rate limit               | Middleware rate limit (10 req/min login, 60 req/min API)            |
| MCP injection            | Permission guard por agent; tool whitelist                          |
| Destructive actions      | Confirm dialog obrigatório (rm, send, publish)                      |

### 6.2 Permission Guard

```typescript
// packages/domain/src/services/PermissionResolver.ts
export interface PermissionResolver {
  canUseTool(agent: Agent, toolName: ToolName, input: unknown): Promise<PermissionResult>;
}

export type PermissionResult =
  | { type: 'allow' }
  | { type: 'deny'; reason: string }
  | { type: 'ask'; prompt: string };
```

Regras:

- Safe tools (Read, Grep, Glob, Web\*): allow
- Write/Edit em allowed paths: allow
- Destructive (rm, sudo, send email, git push): ask
- Unknown: deny

---

## 7. Performance

### 7.1 Otimizações Aplicadas

- **Code-splitting**: dynamic imports por rota (`next/dynamic`)
- **Server Components**: 70% das pages são RSC (zero JS ao browser)
- **Streaming SSR**: chat/pipeline/harness com Suspense boundaries
- **TanStack Query**: cache de 5min para dados estáticos (agents, skills)
- **Optimistic UI**: Server Actions com revalidate + revalidatePath
- **Virtualization**: react-window para listas longas (chat history)
- **Debouncing**: 300ms em inputs (search, form fields)
- **Lazy loading**: voice engine (1.3MB) só carrega quando abre panel

### 7.2 Database Optimization

- **WAL mode**: concorrência read/write
- **Indices**: B-tree em FK + frequently queried columns
- **Prepared statements**: Drizzle auto-gera
- **Batch inserts**: chunks knowledge em batches de 100
- **Connection pooling**: não necessário (single-process)

---

## 8. Distribuição

### 8.1 Modos

| Modo                          | Descrição                      | Use case                   |
| ----------------------------- | ------------------------------ | -------------------------- |
| **Dev**                       | `pnpm dev` → Next dev + Worker | Desenvolvimento            |
| **Production (PWA)**          | `pnpm build && pnpm start`     | Self-hosted em produção    |
| **Binary (Electron wrapper)** | `pnpm dist:mac`                | DMG/NSIS para distribuição |

### 8.2 Build Pipeline

```
pnpm turbo build
├── packages/shared-types → dist/
├── packages/domain → dist/
├── packages/use-cases → dist/
├── packages/infra → dist/
├── apps/worker → dist/
├── apps/sidecar → .next/
└── apps/web → .next/
```

---

## 9. Monitoramento & Observabilidade

### 9.1 Logs

**Pino** estruturado (JSON em prod, pretty em dev):

```typescript
logger.info({ userId, agentId, sessionId, durationMs }, 'message sent');
logger.error({ err, context }, 'failed to save agent');
```

### 9.2 Métricas

**Collectd in-app** (sem external dep):

```typescript
metrics.increment('chat.messages.sent');
metrics.histogram('chat.ttft', ttftMs);
metrics.gauge('memory.usage', process.memoryUsage().rss);
```

### 9.3 Tracing

**Correlation ID** em todas as requests:

```typescript
// Middleware
const correlationId = req.headers.get('x-correlation-id') ?? crypto.randomUUID();
res.headers.set('x-correlation-id', correlationId);
// Logged em todos os logs da request
```

### 9.4 Crash Reporting (opt-in)

Sentry SDK (futuro, opt-in via Settings).

---

## 10. Próximos Passos

Ver [`IMPLEMENTATION_PLAN.md`](./IMPLEMENTATION_PLAN.md) para o roadmap faseado.

---

## Apêndice A — Glossário

| Termo      | Definição                                              |
| ---------- | ------------------------------------------------------ |
| **Squad**  | Categoria de agent (harness, workflow, enrich, custom) |
| **Sprint** | Unidade de trabalho no Harness (1+ features)           |
| **Round**  | Iteração Coder→Evaluator dentro de uma feature         |
| **MCP**    | Model Context Protocol (stdio JSON-RPC)                |
| **SPEC**   | Specification (Markdown estruturado)                   |
| **PRD**    | Product Requirements Document                          |
| **ADR**    | Architecture Decision Record                           |
| **RSC**    | React Server Component                                 |
| **SSE**    | Server-Sent Events (HTTP streaming)                    |
| **TTFT**   | Time To First Token                                    |
| **PTY**    | Pseudo-Terminal                                        |

## Apêndice B — Links Externos

- [Clean Architecture](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [SOLID Principles](https://en.wikipedia.org/wiki/SOLID)
- [Next.js 15 Docs](https://nextjs.org/docs)
- [Drizzle ORM](https://orm.drizzle.team/)
- [MCP Protocol](https://modelcontextprotocol.io/)
- [shadcn/ui](https://ui.shadcn.com/)
