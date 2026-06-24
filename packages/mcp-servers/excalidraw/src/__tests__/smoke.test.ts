import { handleRpcMessage } from '@wolfkrow/mcp-shared';
import { describe, expect, it } from 'vitest';


import { handlers } from '../index';

describe('excalidraw MCP server smoke tests', () => {
  it('initialize handshake returns protocol version and tools capability', async () => {
    const res = await handleRpcMessage({ jsonrpc: '2.0', id: 1, method: 'initialize' }, handlers);
    expect(res?.result).toMatchObject({
      protocolVersion: expect.any(String),
      capabilities: { tools: {} },
    });
  });

  it('tools/list returns create_flow, create_sequence, create_mindmap', async () => {
    const res = await handleRpcMessage({ jsonrpc: '2.0', id: 2, method: 'tools/list' }, handlers);
    const tools = (res?.result as { tools: { name: string }[] })?.tools ?? [];
    const names = tools.map((t) => t.name);
    expect(names).toEqual(
      expect.arrayContaining(['create_flow', 'create_sequence', 'create_mindmap']),
    );
  });

  it('create_flow returns Excalidraw scene with elements', async () => {
    const res = await handleRpcMessage(
      {
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: {
          name: 'create_flow',
          arguments: {
            title: 'API flow',
            nodes: [
              { id: 'a', label: 'Client' },
              { id: 'b', label: 'Server' },
            ],
            edges: [{ from: 'a', to: 'b', label: 'GET' }],
          },
        },
      },
      handlers,
    );
    expect(res?.result).toMatchObject({ content: expect.any(Array) });
    const text = (res?.result as { content: { text: string }[] }).content[0]?.text ?? '{}';
    const scene = JSON.parse(text) as {
      type: string;
      elements: unknown[];
      title: string;
    };
    expect(scene.type).toBe('excalidraw');
    expect(scene.title).toBe('API flow');
    expect(scene.elements.length).toBeGreaterThanOrEqual(5);
  });

  it('create_sequence returns scene with actors and messages', async () => {
    const res = await handleRpcMessage(
      {
        jsonrpc: '2.0',
        id: 4,
        method: 'tools/call',
        params: {
          name: 'create_sequence',
          arguments: {
            actors: ['User', 'API'],
            messages: [{ from: 'User', to: 'API', label: 'login' }],
          },
        },
      },
      handlers,
    );
    const text = (res?.result as { content: { text: string }[] }).content[0]?.text ?? '{}';
    const scene = JSON.parse(text) as { elements: unknown[] };
    expect(scene.elements.length).toBeGreaterThanOrEqual(4);
  });

  it('create_mindmap returns scene with root and branches', async () => {
    const res = await handleRpcMessage(
      {
        jsonrpc: '2.0',
        id: 5,
        method: 'tools/call',
        params: {
          name: 'create_mindmap',
          arguments: {
            root: 'Architecture',
            branches: [
              { label: 'Frontend', children: ['React', 'Tailwind'] },
              { label: 'Backend', children: ['Fastify', 'Drizzle'] },
            ],
          },
        },
      },
      handlers,
    );
    const text = (res?.result as { content: { text: string }[] }).content[0]?.text ?? '{}';
    const scene = JSON.parse(text) as { elements: unknown[]; title: string };
    expect(scene.title).toContain('Architecture');
    expect(scene.elements.length).toBeGreaterThanOrEqual(7);
  });

  it('unknown tool returns isError', async () => {
    const res = await handleRpcMessage(
      { jsonrpc: '2.0', id: 6, method: 'tools/call', params: { name: 'nope', arguments: {} } },
      handlers,
    );
    expect(res?.result).toMatchObject({ isError: true });
  });
});
