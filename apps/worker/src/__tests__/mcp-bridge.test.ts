import { join } from 'node:path';

import { describe, it, expect, afterEach } from 'vitest';

import { createMcpManager } from '../mcp/manager';
import type { McpManager } from '../mcp/manager';

const MOCK_SERVER = join(import.meta.dirname, '../test-utils/mock-mcp-server.mjs');

describe('MCP JSON-RPC bridge', () => {
  let manager: McpManager;

  afterEach(async () => {
    await manager.stopAll();
  });

  it('initializes and lists tools on start', async () => {
    manager = createMcpManager({ rpcTimeoutMs: 5000 });
    const state = await manager.start({ name: 'srv', command: 'node', args: [MOCK_SERVER] });
    expect(state.status).toBe('running');
    const tools = manager.listTools('srv');
    expect(tools).toHaveLength(1);
    expect(tools[0]?.name).toBe('echo');
  });

  it('call returns result from server', async () => {
    manager = createMcpManager({ rpcTimeoutMs: 5000 });
    await manager.start({ name: 'srv', command: 'node', args: [MOCK_SERVER] });
    const result = await manager.call('srv', 'tools/list', {}) as { tools: Array<{ name: string }> };
    expect(result.tools).toHaveLength(1);
    expect(result.tools[0]?.name).toBe('echo');
  });

  it('callTool invokes tools/call and returns content', async () => {
    manager = createMcpManager({ rpcTimeoutMs: 5000 });
    await manager.start({ name: 'srv', command: 'node', args: [MOCK_SERVER] });
    const result = await manager.callTool('srv', 'echo', { msg: 'hello' });
    expect(result.content[0]?.text).toContain('hello');
  });

  it('listAllTools returns map of all running servers', async () => {
    manager = createMcpManager({ rpcTimeoutMs: 5000 });
    await manager.start({ name: 'a', command: 'node', args: [MOCK_SERVER] });
    await manager.start({ name: 'b', command: 'node', args: [MOCK_SERVER] });
    const all = manager.listAllTools();
    expect(all.size).toBe(2);
    expect(all.get('a')).toHaveLength(1);
  });

  it('throws when calling unknown server', async () => {
    manager = createMcpManager({ rpcTimeoutMs: 5000 });
    expect(() => manager.listTools('nope')).toThrow(/not running/i);
  });

  it('concurrent calls on same server work', async () => {
    manager = createMcpManager({ rpcTimeoutMs: 5000 });
    await manager.start({ name: 'srv', command: 'node', args: [MOCK_SERVER] });
    const [r1, r2, r3] = await Promise.all([
      manager.call('srv', 'tools/list', {}),
      manager.callTool('srv', 'echo', { n: 1 }),
      manager.callTool('srv', 'echo', { n: 2 }),
    ]);
    const toolsList = r1 as { tools: Array<{ name: string }> };
    expect(toolsList.tools).toHaveLength(1);
    expect(toolsList.tools[0]?.name).toBe('echo');
    expect((r2 as { content: Array<{ text: string }> }).content[0]?.text).toContain('"n":1');
    expect((r3 as { content: Array<{ text: string }> }).content[0]?.text).toContain('"n":2');
  });
});
