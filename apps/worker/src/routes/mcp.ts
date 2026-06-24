/**
 * MCP routes
 *
 * Lifecycle: list/start/stop/restart/health servers.
 * Tools (FIX-017): list a running server's tools and invoke one over HTTP.
 */

import type { FastifyInstance, FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';

import { loadBuiltInMcpCatalog } from '../mcp/catalog';
import { createMcpManager } from '../mcp/manager';
import type { McpManager, McpServerConfig, McpServerState } from '../mcp/manager';

// Singleton used by the worker boot (startMcpsAsync) and as the default for the
// route plugin when no manager is injected (e.g. in tests).
export const mcpManager: McpManager = createMcpManager();

export interface McpRouteOptions {
  manager?: McpManager;
}

interface McpBody {
  name: string;
  enabled?: boolean;
}

interface ToolCallBody {
  tool: string;
  arguments?: Record<string, unknown>;
}

interface HealthBody {
  name: string;
  status: 'starting' | 'running' | 'stopped' | 'crashed';
  running: boolean;
  healthy: boolean;
  tools: number;
  restarts: number;
  latencyMs?: number;
  lastError?: string;
}

function catalogEntry(name: string): McpServerConfig | undefined {
  return loadBuiltInMcpCatalog().find((s) => s.name === name);
}

function paramsOf(request: FastifyRequest): { name: string } {
  return request.params as { name: string };
}

function stoppedBody(name: string): HealthBody {
  return {
    name,
    status: 'stopped',
    running: false,
    healthy: false,
    tools: 0,
    restarts: 0,
  };
}

function crashedBody(state: McpServerState, message?: string): HealthBody {
  const body: HealthBody = {
    name: state.config.name,
    status: 'crashed',
    running: false,
    healthy: false,
    tools: 0,
    restarts: state.restarts,
  };
  if (message !== undefined) body.lastError = message;
  return body;
}

function healthyBody(
  state: McpServerState,
  tools: unknown[],
  latencyMs: number,
): HealthBody {
  return {
    name: state.config.name,
    status: state.status,
    running: true,
    healthy: true,
    tools: tools.length,
    restarts: state.restarts,
    latencyMs,
  };
}

function healthStatusFor(state: McpServerState | undefined, inCatalog: boolean): {
  statusCode: 200 | 404 | 503;
  body: HealthBody | { error: string };
} {
  if (!state && !inCatalog) {
    return { statusCode: 404, body: { error: 'not found' } };
  }
  if (!state) {
    return { statusCode: 503, body: stoppedBody('unknown') };
  }
  if (state.status === 'crashed') {
    return { statusCode: 503, body: crashedBody(state, state.lastError) };
  }
  return { statusCode: 200, body: state as unknown as HealthBody };
}

function registerListRoute(
  server: FastifyInstance,
  manager: McpManager,
  auth: { preHandler: Array<(request: FastifyRequest, reply: FastifyReply) => Promise<void>> },
): void {
  server.get('/servers', auth, async () => {
    const catalog = loadBuiltInMcpCatalog();
    const running = manager.list();
    return {
      servers: catalog.map((entry) => ({
        ...entry,
        running: running.some((s) => s.config.name === entry.name),
        status: running.find((s) => s.config.name === entry.name)?.status ?? 'stopped',
      })),
    };
  });
}

function registerLifecycleActionRoutes(
  server: FastifyInstance,
  manager: McpManager,
  auth: { preHandler: Array<(request: FastifyRequest, reply: FastifyReply) => Promise<void>> },
): void {
  server.post<{ Body: McpBody }>('/servers/:name/start', auth, async (request, reply) => {
    const { name } = paramsOf(request);
    const entry = catalogEntry(name);
    if (!entry) return reply.status(404).send({ error: `MCP server ${name} not found` });
    const state = await manager.start(entry);
    return reply.status(202).send({ name, status: state.status });
  });

  server.post<{ Body: McpBody }>('/servers/:name/stop', auth, async (request, reply) => {
    const { name } = paramsOf(request);
    await manager.stop(name);
    return reply.status(202).send({ name, status: 'stopped' });
  });

  server.post<{ Body: McpBody }>('/servers/:name/restart', auth, async (request, reply) => {
    const { name } = paramsOf(request);
    const state = await manager.restart(name);
    return reply.status(202).send({ name, status: state.status });
  });
}

async function runHealthCheck(
  manager: McpManager,
  name: string,
  reply: FastifyReply,
): Promise<void> {
  const state = manager.get(name);
  const inCatalog = Boolean(catalogEntry(name));
  const preliminary = healthStatusFor(state, inCatalog);
  if (preliminary.statusCode === 404) {
    reply.status(404).send({ error: `MCP server ${name} not found` });
    return;
  }
  if (preliminary.statusCode === 503) {
    const body = preliminary.body as HealthBody;
    if (state) {
      reply.status(503).send({ ...body, name });
    } else {
      reply.status(503).send({ ...body, name });
    }
    return;
  }
  const liveState = state as McpServerState;
  const startedAt = Date.now();
  try {
    const tools = await manager.listTools(name);
    const latencyMs = Date.now() - startedAt;
    reply.status(200).send(healthyBody(liveState, tools, latencyMs));
  } catch (err) {
    reply.status(503).send(crashedBody(liveState, (err as Error).message));
  }
}

function registerHealthRoute(
  server: FastifyInstance,
  manager: McpManager,
  auth: { preHandler: Array<(request: FastifyRequest, reply: FastifyReply) => Promise<void>> },
): void {
  server.get<{ Params: { name: string } }>('/servers/:name/health', auth, async (request, reply) => {
    await runHealthCheck(manager, paramsOf(request).name, reply);
  });
}

function registerLifecycleRoutes(
  server: FastifyInstance,
  manager: McpManager,
  auth: { preHandler: Array<(request: FastifyRequest, reply: FastifyReply) => Promise<void>> },
): void {
  registerListRoute(server, manager, auth);
  registerLifecycleActionRoutes(server, manager, auth);
  registerHealthRoute(server, manager, auth);
}

function registerToolsListRoute(
  server: FastifyInstance,
  manager: McpManager,
  auth: { preHandler: Array<(request: FastifyRequest, reply: FastifyReply) => Promise<void>> },
): void {
  server.get<{ Params: { name: string } }>('/servers/:name/tools', auth, async (request, reply) => {
    const { name } = paramsOf(request);
    if (!manager.get(name)) {
      return reply.status(400).send({ error: `MCP server ${name} is not running` });
    }
    return reply.send({ tools: manager.listTools(name) });
  });
}

async function handleToolCall(
  manager: McpManager,
  request: FastifyRequest<{ Params: { name: string }; Body: ToolCallBody }>,
  reply: FastifyReply,
): Promise<void> {
  const { name } = request.params;
  const body = request.body ?? {};
  if (!body.tool) {
    reply.status(400).send({ error: 'tools/call requires a "tool" name' });
    return;
  }
  if (!manager.get(name)) {
    reply.status(400).send({ error: `MCP server ${name} is not running` });
    return;
  }
  try {
    const result = await manager.callTool(name, body.tool, body.arguments ?? {});
    reply.send({ result });
  } catch (err) {
    reply.status(500).send({ error: (err as Error).message });
  }
}

function registerToolCallRoute(
  server: FastifyInstance,
  manager: McpManager,
  auth: { preHandler: Array<(request: FastifyRequest, reply: FastifyReply) => Promise<void>> },
): void {
  server.post<{ Params: { name: string }; Body: ToolCallBody }>(
    '/servers/:name/tools/call',
    auth,
    async (request, reply) => {
      await handleToolCall(manager, request, reply);
    },
  );
}

function registerToolRoutes(
  server: FastifyInstance,
  manager: McpManager,
  auth: { preHandler: Array<(request: FastifyRequest, reply: FastifyReply) => Promise<void>> },
): void {
  registerToolsListRoute(server, manager, auth);
  registerToolCallRoute(server, manager, auth);
}

export const mcpRoutes: FastifyPluginAsync<McpRouteOptions> = async (server, opts) => {
  const manager = opts.manager ?? mcpManager;
  const auth = { preHandler: [server.authenticate] };
  registerLifecycleRoutes(server, manager, auth);
  registerToolRoutes(server, manager, auth);
};
