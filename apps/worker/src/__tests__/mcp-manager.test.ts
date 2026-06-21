import { describe, it, expect } from 'vitest';

import { createMcpManager } from '../mcp/manager';

describe('McpManager', () => {
  it('starts and stops a mock MCP server', async () => {
    const manager = createMcpManager();
    const state = await manager.start({
      name: 'echo',
      command: 'node',
      args: ['-e', "setInterval(() => {}, 1000)"],
    });

    expect(state.status).toBe('running');
    expect(manager.get('echo')).toBeDefined();

    await manager.stop('echo');
    expect(manager.get('echo')).toBeUndefined();
  });

  it('throws when starting same server twice', async () => {
    const manager = createMcpManager();
    await manager.start({
      name: 'dup',
      command: 'node',
      args: ['-e', "setInterval(() => {}, 1000)"],
    });

    await expect(
      manager.start({
        name: 'dup',
        command: 'node',
        args: ['-e', "setInterval(() => {}, 1000)"],
      })
    ).rejects.toThrow('already running');

    await manager.stop('dup');
  });

  it('stops all servers', async () => {
    const manager = createMcpManager();
    await manager.start({
      name: 'a',
      command: 'node',
      args: ['-e', "setInterval(() => {}, 1000)"],
    });
    await manager.start({
      name: 'b',
      command: 'node',
      args: ['-e', "setInterval(() => {}, 1000)"],
    });

    await manager.stopAll();
    expect(manager.list()).toHaveLength(0);
  });
});
