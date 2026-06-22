import { join } from 'node:path';

import { describe, it, expect } from 'vitest';

import { createMcpManager } from '../mcp/manager';

const MOCK_SERVER = join(import.meta.dirname, '../test-utils/mock-mcp-server.mjs');

describe('McpManager', () => {
  it('starts and stops a mock MCP server', async () => {
    const manager = createMcpManager({ rpcTimeoutMs: 5000 });
    const state = await manager.start({
      name: 'echo',
      command: 'node',
      args: [MOCK_SERVER],
    });

    expect(state.status).toBe('running');
    expect(manager.get('echo')).toBeDefined();

    await manager.stop('echo');
    expect(manager.get('echo')).toBeUndefined();
  });

  it('throws when starting same server twice', async () => {
    const manager = createMcpManager({ rpcTimeoutMs: 5000 });
    await manager.start({ name: 'dup', command: 'node', args: [MOCK_SERVER] });

    await expect(
      manager.start({ name: 'dup', command: 'node', args: [MOCK_SERVER] })
    ).rejects.toThrow('already running');

    await manager.stop('dup');
  });

  it('stops all servers', async () => {
    const manager = createMcpManager({ rpcTimeoutMs: 5000 });
    await manager.start({ name: 'a', command: 'node', args: [MOCK_SERVER] });
    await manager.start({ name: 'b', command: 'node', args: [MOCK_SERVER] });

    await manager.stopAll();
    expect(manager.list()).toHaveLength(0);
  });
});
