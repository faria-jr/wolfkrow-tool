import { join } from 'node:path';

import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createMcpManager } from '../mcp/manager';
import type { McpManager } from '../mcp/manager';
import { mcpRoutes } from '../routes/mcp';

/**
 * M3.5 — `GET /mcp/servers/:name/health` exposes the live state of a running
 * MCP server (running, crashed, or stopped) plus the manager's restart count
 * and last error. The endpoint pings `tools/list` so a server that has
 * deadlocked (process alive but unresponsive) is correctly reported as
 * unhealthy.
 */

const MOCK_SERVER = join(import.meta.dirname, '../test-utils/mock-mcp-server.mjs');

async function makeApp(manager: McpManager): Promise<FastifyInstance> {
  const app = Fastify();
  app.decorate('authenticate', async () => {});
  await app.register(mcpRoutes, { prefix: '/mcp', manager });
  return app;
}

describe('MCP health endpoint (M3.5)', () => {
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

  it('returns healthy=true and a tool count when the server responds', async () => {
    const res = await app.inject({ method: 'GET', url: '/mcp/servers/srv/health' });
    expect(res.statusCode).toBe(200);
    const body = res.json() as {
      name: string;
      running: boolean;
      healthy: boolean;
      status: string;
      tools: number;
      restarts: number;
      latencyMs: number;
    };
    expect(body.name).toBe('srv');
    expect(body.running).toBe(true);
    expect(body.healthy).toBe(true);
    expect(body.status).toBe('running');
    expect(body.tools).toBeGreaterThanOrEqual(1);
    expect(body.restarts).toBe(0);
    expect(body.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('returns 404 when the manager has no record of the server', async () => {
    await manager.stop('srv');
    const res = await app.inject({ method: 'GET', url: '/mcp/servers/srv/health' });
    expect(res.statusCode).toBe(404);
  });

  it('returns 404 for an unknown server name', async () => {
    const res = await app.inject({ method: 'GET', url: '/mcp/servers/ghost/health' });
    expect(res.statusCode).toBe(404);
  });

  it('reports restarts count and lastError after a crash', async () => {
    const liveState = manager.get('srv');
    expect(liveState).toBeDefined();
    if (liveState) {
      liveState.status = 'crashed';
      liveState.lastError = 'simulated crash';
      liveState.restarts = 2;
    }
    const res = await app.inject({ method: 'GET', url: '/mcp/servers/srv/health' });
    expect(res.statusCode).toBe(503);
    const body = res.json() as {
      status: string;
      healthy: boolean;
      restarts: number;
      lastError?: string;
    };
    expect(body.status).toBe('crashed');
    expect(body.healthy).toBe(false);
    expect(body.restarts).toBe(2);
    expect(body.lastError).toBe('simulated crash');
  });
});
