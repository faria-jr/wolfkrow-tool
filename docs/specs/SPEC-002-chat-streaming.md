# SPEC-002: Chat com SSE Streaming

**Status**: 📝 Draft
**Camada**: Web + Worker
**Prioridade**: P0 (bloqueador)
**Owner**: Tech Lead

---

## 1. Visão Geral

Chat conversacional multi-SDK (4 providers) com streaming SSE de tokens, tool calls inline, e metadata em tempo real.

### Objetivos
- Streaming SSE <500ms TTFT (Time To First Token)
- 4 SDKs: Claude Agent, Claude-compat, Codex, Lion-SDK
- Tool calls renderizados inline (Read, Bash, Web*, etc)
- Cancel/abort support
- Multi-session support
- Markdown rendering com syntax highlighting
- Code blocks copy-to-clipboard
- Attachments (images, PDFs, files)

---

## 2. Requisitos Funcionais

### User Stories

- **US-1**: Como usuário, quero enviar mensagem e receber resposta streamed
- **US-2**: Como usuário, quero ver tool calls acontecendo em tempo real
- **US-3**: Como usuário, quero poder cancelar generation no meio
- **US-4**: Como usuário, quero criar múltiplas conversas e navegar entre elas
- **US-5**: Como usuário, quero anexar imagens, PDFs, code files
- **US-6**: Como usuário, quero syntax highlighting em code blocks
- **US-7**: Como usuário, quero copiar code blocks com 1 clique
- **US-8**: Como usuário, quero title generation automático
- **US-9**: Como usuário, quero ver token count + cost em tempo real

### Critérios de Aceitação

- [ ] Streaming via SSE com heartbeat a cada 30s
- [ ] TTFT <500ms (P95)
- [ ] Cancel button interrompe imediatamente
- [ ] Multi-session support (criar, listar, deletar, arquivar)
- [ ] Attachments: PNG, JPG, PDF, MD, code files
- [ ] Markdown rendering: GFM + syntax highlighting
- [ ] Code copy button em todos blocks
- [ ] Title generation async (background)
- [ ] Token count + cost displayed in real-time
- [ ] Auto-scroll to bottom em novas mensagens
- [ ] Scroll up para ver histórico
- [ ] Keyboard shortcuts: Enter send, Shift+Enter newline, Cmd+K command palette

---

## 3. Arquitetura

```
┌─────────────────────────────────────────────────────────┐
│              Browser (Next.js + React)                   │
│                                                          │
│  ChatPage (Client Component)                             │
│  ├─ ChatView (RSC: list sessions)                       │
│  ├─ MessageList (Client: virtualized)                   │
│  ├─ ChatMessage (Client: markdown + tools)              │
│  ├─ ChatInput (Client: textarea + attachments)          │
│  ├─ StreamingIndicator (Client)                          │
│  └─ TokenCounter (Client)                                │
│                                                          │
│  State (Zustand):                                        │
│  ├─ chat-stream.store (SSE chunks ephemeral)            │
│  ├─ chat-session.store (session list)                   │
│  └─ chat-attachments.store (uploads)                    │
│                                                          │
│  useChatStream(sessionId):                               │
│  └─ EventSource('/api/chat/stream/{id}')                │
│      ├─ onmessage: parse chunk → store                  │
│      ├─ onerror: reconnect with backoff                 │
│      └─ cleanup: close on unmount                       │
└──────────────────────────┬───────────────────────────────┘
                           │ SSE
                           ▼
┌─────────────────────────────────────────────────────────┐
│        Next.js Route Handler (/api/chat/*)               │
│                                                          │
│  POST /api/chat/send                                     │
│  └─ forwardToWorker('/chat/send', body, (chunk) => {    │
│       controller.enqueue(`data: ${JSON.stringify(chunk)}`│
│     })                                                   │
│                                                          │
│  GET /api/chat/stream/{id}                               │
│  └─ forwardToWorker('/chat/stream/{id}', SSE)            │
└──────────────────────────┬───────────────────────────────┘
                           │ HTTP/SSE
                           ▼
┌─────────────────────────────────────────────────────────┐
│                Worker (Node.js)                          │
│                                                          │
│  POST /chat/send                                         │
│  └─ SendMessage.execute(input): AsyncIterable<chunk>    │
│      ├─ Get agent + session + message                   │
│      ├─ Save user message                                │
│      ├─ Publish MessageSent event                        │
│      ├─ Provider.query(prompt) → stream chunks         │
│      └─ For each chunk:                                  │
│          ├─ Save partial assistant message               │
│          ├─ Publish MessageChunk event                   │
│          └─ Yield chunk to client                        │
│                                                          │
│  AI Providers (Strategy):                                │
│  ├─ ClaudeAgentSDKProvider                              │
│  ├─ ClaudeCompatSDKProvider                             │
│  ├─ CodexSDKProvider                                    │
│  └─ LionSDKProvider                                     │
└─────────────────────────────────────────────────────────┘
```

---

## 4. Stream Chunk Types

```typescript
// packages/shared-types/src/sse/chat-events.ts
export const ChatStreamChunkSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('start'),
    sessionId: z.string(),
    messageId: z.string(),
    agent: z.object({
      id: z.string(),
      name: z.string(),
      model: z.string(),
    }),
  }),
  z.object({
    type: z.literal('text'),
    content: z.string(),
  }),
  z.object({
    type: z.literal('tool_call'),
    id: z.string(),
    name: z.string(),
    input: z.record(z.unknown()),
  }),
  z.object({
    type: z.literal('tool_result'),
    id: z.string(),
    output: z.unknown(),
    isError: z.boolean().default(false),
  }),
  z.object({
    type: z.literal('usage'),
    inputTokens: z.number(),
    outputTokens: z.number(),
    cacheReadTokens: z.number().default(0),
    cacheWriteTokens: z.number().default(0),
    cost: z.number(),
  }),
  z.object({
    type: z.literal('done'),
    sessionId: z.string(),
    messageId: z.string(),
    totalUsage: z.object({
      inputTokens: z.number(),
      outputTokens: z.number(),
      cost: z.number(),
    }),
  }),
  z.object({
    type: z.literal('error'),
    message: z.string(),
    code: z.string().optional(),
  }),
]);
```

---

## 5. Database Schema

```typescript
// packages/infra/src/db/schema/chat.ts
export const chatSessions = sqliteTable('chat_sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  agentId: text('agent_id').notNull(),
  title: text('title'),
  archived: integer('archived', { mode: 'boolean' }).default(false),
  metadata: text('metadata', { mode: 'json' }).$type<Record<string, unknown>>().default({}),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  lastActivity: integer('last_activity', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export const chatMessages = sqliteTable('chat_messages', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull().references(() => chatSessions.id, { onDelete: 'cascade' }),
  role: text('role', { enum: ['user', 'assistant', 'system', 'tool'] }).notNull(),
  content: text('content').notNull(),
  attachments: text('attachments', { mode: 'json' }).$type<string[]>().default([]),
  toolCalls: text('tool_calls', { mode: 'json' }).$type<ToolCall[]>().default([]),
  metadata: text('metadata', { mode: 'json' }).$type<MessageMetadata>().default({}),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export const chatAttachments = sqliteTable('chat_attachments', {
  id: text('id').primaryKey(),
  messageId: text('message_id').notNull().references(() => chatMessages.id, { onDelete: 'cascade' }),
  filename: text('filename').notNull(),
  mimeType: text('mime_type').notNull(),
  size: integer('size').notNull(),
  path: text('path').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});
```

---

## 6. AI Provider Strategy

```typescript
// packages/infra/src/ai-providers/types.ts
export interface AIProvider {
  readonly id: string;
  readonly displayName: string;
  
  query(prompt: Prompt, options: QueryOptions): AsyncIterable<StreamChunk>;
  countTokens(text: string): Promise<number>;
  estimateCost(usage: TokenUsage): number;
}

export interface Prompt {
  system: string;
  messages: Message[];
  tools: Tool[];
  model: string;
  maxTokens: number;
  temperature?: number;
}

export interface QueryOptions {
  signal: AbortSignal;
  onChunk?: (chunk: StreamChunk) => void;
  metadata?: Record<string, unknown>;
}
```

### Claude Agent SDK Implementation

```typescript
// packages/infra/src/ai-providers/claude-agent-sdk-provider.ts
export class ClaudeAgentSDKProvider implements AIProvider {
  readonly id = 'claude-agent-sdk';
  readonly displayName = 'Claude Agent SDK';
  
  constructor(private config: ClaudeConfig) {}
  
  async *query(prompt: Prompt, options: QueryOptions): AsyncIterable<StreamChunk> {
    const sdk = new ClaudeAgentSDK({ apiKey: this.config.apiKey });
    
    for await (const event of sdk.query(prompt, { signal: options.signal })) {
      yield this.translate(event);
    }
  }
  
  private translate(event: ClaudeEvent): StreamChunk {
    // Map Claude events to our StreamChunk format
    switch (event.type) {
      case 'message_start':
        return { type: 'start', sessionId: ..., messageId: event.message.id, agent: ... };
      case 'content_block_delta':
        return { type: 'text', content: event.delta.text };
      case 'content_block_start':
        if (event.content_block.type === 'tool_use') {
          return { type: 'tool_call', id: event.content_block.id, name: event.content_block.name, input: {} };
        }
        break;
      // ... etc
    }
  }
  
  // ... countTokens, estimateCost
}
```

---

## 7. UI/UX

### ChatPage Layout

```
┌──────────────────────────────────────────────────────┐
│ [Sidebar]  │  Sessions     │  Chat                    │
│            │  ┌─────────┐ │ ┌──────────────────────┐│
│  • Chat    │  │ Chat 1  │ │ │ 🤖 Assistant         ││
│  • Agents  │  │ Chat 2* │ │ │                       ││
│  • ...     │  │ Chat 3  │ │ │ Hello! How can I...   ││
│            │  │ + New   │ │ │                       ││
│            │  └─────────┘ │ │ ─────────────────── ││
│            │              │ │                       ││
│            │              │ │ 👤 User               ││
│            │              │ │ Help me with React    ││
│            │              │ │                       ││
│            │              │ │ 🤖 Assistant ●        ││
│            │              │ │ Sure! Let me explain  ││
│            │              │ │                       ││
│            │              │ │ [Stop] [Tokens: 245]  ││
│            │              │ ├──────────────────────┤│
│            │              │ │ [📎 Attach] [Type...] ││
│            │              │ │                       ││
│            │              │ │ [Send ↵]              ││
│            │              │ └──────────────────────┘│
└──────────────────────────────────────────────────────┘
```

### ChatMessage Component

```tsx
'use client';
export function ChatMessage({ message, streaming }: { message: ChatMessage; streaming?: boolean }) {
  return (
    <div className={cn('flex gap-3', message.role === 'user' ? 'justify-end' : 'justify-start')}>
      <Avatar>{message.role === 'user' ? '👤' : '🤖'}</Avatar>
      <div className="flex-1">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeHighlight]}
          components={{
            pre: CodeBlock,  // Custom with copy button
            // ... tool calls rendered inline
          }}
        >
          {message.content}
        </ReactMarkdown>
        
        {message.toolCalls?.map((tool) => (
          <ToolCallCard key={tool.id} tool={tool} />
        ))}
        
        {streaming && <span className="animate-pulse">▊</span>}
      </div>
    </div>
  );
}
```

---

## 8. Performance Targets

| Metric | Target | Measurement |
|---|---|---|
| TTFT | <500ms (P95) | Prometheus metrics |
| Total latency | <5s for 100 tokens | End-to-end timing |
| SSE reconnection | <2s | Auto-reconnect |
| Message rendering | <16ms per message (60fps) | React DevTools |
| Memory usage | <100MB for 1000 messages | Browser DevTools |

---

## 9. Testes

### Unit
- `SendMessage.execute()`: happy path + error cases
- `Message.fromRow()`: Drizzle row → Message
- Token counting per provider
- Cost estimation per provider

### Integration
- Full flow: send → stream → save → display
- Cancel mid-stream
- Reconnect after disconnect
- Tool call rendering
- Attachment upload + processing

### E2E
- User sends message → response streamed
- User cancels mid-stream
- User creates new session
- User attaches image
- User views history

---

## 10. Riscos

| Risco | Mitigação |
|---|---|
| SSE bloqueado por firewall | Fallback long-polling |
| Provider rate limit | Exponential backoff + queue |
| Long-running generation | Timeout 5min, can resume |
| Tool call loop infinito | Max iterations + timeout |
| Context overflow | Auto-compaction on threshold |
| Attachments grandes (>10MB) | Streaming upload + size limit |
| Multiple tabs SSE | Tab leader pattern (BroadcastChannel) |
