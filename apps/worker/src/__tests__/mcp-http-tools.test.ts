import { join } from 'node:path';

import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createMcpManager } from '../mcp/manager';
import type { McpManager } from '../mcp/manager';
import { mcpRoutes } from '../routes/mcp';

/**
 * FIX-017 — `manager.listTools`/`callTool` must be reachable over HTTP. We
 * build a Fastify app with a no-op `authenticate` (so no JWKS/JWT is needed)
 * and a real manager running the mock echo server, then drive the new
 * endpoints via `inject`.
 */

const MOCK_SERVER = join(import.meta.dirname, '../test-utils/mock-mcp-server.mjs');

async function makeApp(manager: McpManager): Promise<FastifyInstance> {
  const app = Fastify();
  app.decorate('authenticate', async () => {});
  await app.register(mcpRoutes, { prefix: '/mcp', manager });
  return app;
}

describe('MCP HTTP tools endpoints (FIX-017)', () => {
  let manager: McpManager;
  let app: FastifyInstance;

  beforeEach(async () => {
    manager = createMcpManager({ rpcTimeoutMs: 5000 });
    await manager.start({ name: 'srv', command: 'node', args: [MOCK_SERVER] });
    app = await makeApp(manager);
  });

  afterEach(async () => {
    await app.close();
    await manager.stopAll();
  });

  it('GET /mcp/servers/:name/tools lists the running server tools', async () => {
    const res = await app.inject({ method: 'GET', url: '/mcp/servers/srv/tools' });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { tools: Array<{ name: string }> };
    expect(body.tools[0]?.name).toBe('echo');
  });

  it('POST /mcp/servers/:name/tools/call invokes a tool', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/mcp/servers/srv/tools/call',
      payload: { tool: 'echo', arguments: { msg: 'hello' } },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { result: { content: Array<{ text: string }> } };
    expect(body.result.content[0]?.text).toContain('hello');
  });

  it('GET tools on a not-running server returns 400', async () => {
    const res = await app.inject({ method: 'GET', url: '/mcp/servers/ghost/tools' });
    expect(res.statusCode).toBe(400);
  });

  it('POST tools/call without a tool name returns 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/mcp/servers/srv/tools/call',
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });
});
