# SPEC-008: MCP Manager

**Status**: 📝 Draft
**Camada**: Worker
**Prioridade**: P0 (core feature)

---

## 1. Visão Geral

Gerencia 19+ MCP (Model Context Protocol) servers como subprocessos stdio. Fornece JSON-RPC bridge entre o AI agent e os MCPs.

### MCPs Inclusos

| MCP | Função | Auth |
|---|---|---|
| google-calendar | Calendar API | OAuth |
| google-gmail | Gmail API | OAuth |
| google-drive | Drive API | OAuth |
| google-sheets | Sheets API | OAuth |
| elevenlabs | TTS | API key |
| excalidraw | Drawing | None |
| knowledge-base | Semantic search | None |
| memory-search | Memory search | None |
| local-agents | Local agent runner | None |
| local-llm | Ollama | None |
| skills | Skills MCP | None |
| youtube | YouTube transcript | API key |
| shopify | Shopify API | API key |
| nano-banana | Cohere LLM | API key |
| graph-search | Graph search | None |
| wolfkrow-agents | Internal agents | None |
| wolfkrow-skills | Internal skills | None |
| wolfkrow-user-question | User questions | None |

---

## 2. Manager Implementation

```typescript
// apps/worker/src/mcp/manager.ts
export class MCPManager {
  private servers = new Map<string, MCPServer>();
  
  async start(name: string): Promise<void> {
    if (this.servers.has(name)) return;
    
    const config = await this.mcpConfigRepo.findByName(name);
    if (!config) throw new MCPNotFoundError(name);
    
    const child = spawn(config.command, config.args, {
      env: { ...process.env, ...config.env },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    
    const server: MCPServer = {
      name,
      config,
      process: child,
      pendingRequests: new Map(),
      tools: [],
      status: 'starting',
    };
    
    this.setupHandlers(server);
    this.servers.set(name, server);
    
    // Initialize (list tools)
    await this.initialize(server);
    server.status = 'running';
  }
  
  async call(name: string, method: string, params: unknown): Promise<unknown> {
    const server = this.servers.get(name);
    if (!server) throw new MCPNotRunningError(name);
    
    const id = Date.now() + Math.random();
    
    return new Promise((resolve, reject) => {
      server.pendingRequests.set(id, { resolve, reject });
      
      const message = JSON.stringify({
        jsonrpc: '2.0',
        id,
        method,
        params,
      }) + '\n';
      
      server.process!.stdin!.write(message);
      
      // Timeout after 30s
      setTimeout(() => {
        if (server.pendingRequests.has(id)) {
          server.pendingRequests.delete(id);
          reject(new MCPTimeoutError(name, method));
        }
      }, 30_000);
    });
  }
  
  async listTools(name: string): Promise<Tool[]> {
    return this.call(name, 'tools/list', {}) as Promise<Tool[]>;
  }
  
  async listAllTools(): Promise<Map<string, Tool[]>> {
    const result = new Map();
    for (const name of this.servers.keys()) {
      result.set(name, await this.listTools(name));
    }
    return result;
  }
  
  async stop(name: string): Promise<void> {
    const server = this.servers.get(name);
    if (!server) return;
    
    server.process?.kill('SIGTERM');
    await new Promise((r) => setTimeout(r, 1000));
    server.process?.kill('SIGKILL');
    
    this.servers.delete(name);
  }
  
  async startAll(): Promise<void> {
    const configs = await this.mcpConfigRepo.list({ isActive: true });
    await Promise.allSettled(
      configs.map((c) => this.start(c.name))
    );
  }
  
  async stopAll(): Promise<void> {
    await Promise.allSettled(
      Array.from(this.servers.keys()).map((name) => this.stop(name))
    );
  }
}
```

---

## 3. Database Schema

```typescript
export const mcpServers = sqliteTable('mcp_servers', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  description: text('description'),
  command: text('command').notNull(),
  args: text('args', { mode: 'json' }).$type<string[]>().default([]),
  env: text('env', { mode: 'json' }).$type<Record<string, string>>().default({}),
  isActive: integer('is_active', { mode: 'boolean' }).default(false),
  isBuiltIn: integer('is_built_in', { mode: 'boolean' }).default(false),
  visibility: text('visibility', { enum: ['always', 'on-demand', 'background'] }).default('always'),
  healthCheck: text('health_check'),
  metadata: text('metadata', { mode: 'json' }).$type<Record<string, unknown>>().default({}),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export const mcpToolRegistry = sqliteTable('mcp_tool_registry', {
  id: text('id').primaryKey(),
  mcpServerId: text('mcp_server_id').notNull().references(() => mcpServers.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  inputSchema: text('input_schema', { mode: 'json' }),
  lastSynced: integer('last_synced', { mode: 'timestamp' }),
});
```

---

## 4. Tool Auto-Discovery

```typescript
// On MCP startup, query tools/list and cache
async function initialize(server: MCPServer) {
  const response = await this.call(server.name, 'initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'wolfkrow', version: '1.0.0' },
  });
  
  const toolsResponse = await this.call(server.name, 'tools/list', {});
  server.tools = toolsResponse.tools;
  
  // Save to registry
  await this.toolRegistryRepo.upsertMany(
    server.tools.map((tool) => ({
      mcpServerId: server.config.id,
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
      lastSynced: new Date(),
    })),
  );
}
```

---

## 5. UI Components

### MCPServersPage

```tsx
'use client';
export function MCPServersPage() {
  const { data: servers } = useMCPServers();
  
  return (
    <div>
      <h1>MCP Servers</h1>
      <DataTable
        data={servers}
        columns={[
          { accessorKey: 'name', header: 'Name' },
          { accessorKey: 'description', header: 'Description' },
          { accessorKey: 'status', header: 'Status', cell: (s) => <MCPStatusBadge status={s.status} /> },
          { id: 'actions', cell: (s) => <MCPRowActions server={s} /> },
        ]}
      />
      <Button onClick={() => setShowNewModal(true)}>Add MCP</Button>
    </div>
  );
}
```

---

## 6. Testes

### Unit
- Spawn + kill lifecycle
- JSON-RPC request/response
- Timeout handling
- Reconnect on crash

### Integration
- All 19 MCPs start successfully
- Tool calls return expected data
- Concurrent requests handled

### E2E
- User adds custom MCP
- User toggles MCP on/off
- Tool call in chat uses MCP
