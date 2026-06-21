/**
 * MCP routes
 */

import { loadBuiltInMcpCatalog } from '../mcp/catalog';
import { createMcpManager } from '../mcp/manager';
import type { AuthFastifyInstance } from '../types/fastify';

const manager = createMcpManager();

interface McpBody {
  name: string;
  enabled?: boolean;
}

export async function mcpRoutes(server: AuthFastifyInstance) {
  server.get('/servers', { preHandler: [server.authenticate] }, async () => {
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

  server.post<{ Body: McpBody }>('/servers/:name/start', { preHandler: [server.authenticate] }, async (request, reply) => {
    const { name } = request.params as { name: string };
    const catalog = loadBuiltInMcpCatalog();
    const entry = catalog.find((s) => s.name === name);

    if (!entry) {
      return reply.status(404).send({ error: `MCP server ${name} not found` });
    }

    const state = await manager.start(entry);
    return reply.status(202).send({ name, status: state.status });
  });

  server.post<{ Body: McpBody }>('/servers/:name/stop', { preHandler: [server.authenticate] }, async (request, reply) => {
    const { name } = request.params as { name: string };
    await manager.stop(name);
    return reply.status(202).send({ name, status: 'stopped' });
  });

  server.post<{ Body: McpBody }>('/servers/:name/restart', { preHandler: [server.authenticate] }, async (request, reply) => {
    const { name } = request.params as { name: string };
    const state = await manager.restart(name);
    return reply.status(202).send({ name, status: state.status });
  });
}

export { manager as mcpManager };
