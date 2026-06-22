/**
 * MCP routes
 *
 * Lifecycle: list/start/stop/restart servers.
 * Tools (FIX-017): list a running server's tools and invoke one over HTTP.
 */

import type { FastifyInstance, FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';

import { loadBuiltInMcpCatalog } from '../mcp/catalog';
import { createMcpManager } from '../mcp/manager';
import type { McpManager, McpServerConfig } from '../mcp/manager';

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

function catalogEntry(name: string): McpServerConfig | undefined {
  return loadBuiltInMcpCatalog().find((s) => s.name === name);
}

function paramsOf(request: FastifyRequest): { name: string } {
  return request.params as { name: string };
}

function registerLifecycleRoutes(
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

function registerToolRoutes(
  server: FastifyInstance,
  manager: McpManager,
  auth: { preHandler: Array<(request: FastifyRequest, reply: FastifyReply) => Promise<void>> },
): void {
  // FIX-017: expose a running server's tools over HTTP.
  server.get<{ Params: { name: string } }>('/servers/:name/tools', auth, async (request, reply) => {
    const { name } = paramsOf(request);
    if (!manager.get(name)) {
      return reply.status(400).send({ error: `MCP server ${name} is not running` });
    }
    return reply.send({ tools: manager.listTools(name) });
  });

  // FIX-017: invoke a tool on a running server over HTTP.
  server.post<{ Params: { name: string }; Body: ToolCallBody }>(
    '/servers/:name/tools/call',
    auth,
    async (request, reply) => {
      const { name } = paramsOf(request);
      const body = request.body ?? {};
      if (!body.tool) {
        return reply.status(400).send({ error: 'tools/call requires a "tool" name' });
      }
      if (!manager.get(name)) {
        return reply.status(400).send({ error: `MCP server ${name} is not running` });
      }
      try {
        const result = await manager.callTool(name, body.tool, body.arguments ?? {});
        return reply.send({ result });
      } catch (err) {
        return reply.status(500).send({ error: (err as Error).message });
      }
    },
  );
}

export const mcpRoutes: FastifyPluginAsync<McpRouteOptions> = async (server, opts) => {
  const manager = opts.manager ?? mcpManager;
  const auth = { preHandler: [server.authenticate] };
  registerLifecycleRoutes(server, manager, auth);
  registerToolRoutes(server, manager, auth);
};
