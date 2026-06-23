import { handleRpcMessage } from '@wolfkrow/mcp-shared';
import { afterEach, describe, expect, it, vi } from 'vitest';


import { handlers } from '../index';

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env['OLLAMA_HOST'];
});

describe('local-llm MCP server smoke tests', () => {
  it('initialize handshake returns protocol version and tools capability', async () => {
    const res = await handleRpcMessage({ jsonrpc: '2.0', id: 1, method: 'initialize' }, handlers);
    expect(res?.result).toMatchObject({
      protocolVersion: expect.any(String),
      capabilities: { tools: {} },
    });
  });

  it('tools/list returns list_models, show_model, chat_completion', async () => {
    const res = await handleRpcMessage({ jsonrpc: '2.0', id: 2, method: 'tools/list' }, handlers);
    const tools = (res?.result as { tools: { name: string }[] })?.tools ?? [];
    const names = tools.map((t) => t.name);
    expect(names).toEqual(expect.arrayContaining(['list_models', 'show_model', 'chat_completion']));
  });

  it('list_models calls Ollama /api/tags', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ models: [{ name: 'llama3.2:3b' }] }),
      }),
    );

    const res = await handleRpcMessage(
      { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'list_models', arguments: {} } },
      handlers,
    );
    expect(res?.result).toMatchObject({ content: expect.any(Array) });
    expect(vi.mocked(fetch)).toHaveBeenCalledWith('http://localhost:11434/api/tags');
  });

  it('chat_completion posts messages to Ollama /api/chat', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ message: { role: 'assistant', content: 'hi' } }),
      }),
    );

    const res = await handleRpcMessage(
      {
        jsonrpc: '2.0',
        id: 4,
        method: 'tools/call',
        params: {
          name: 'chat_completion',
          arguments: { model: 'llama3.2:3b', messages: [{ role: 'user', content: 'hi' }] },
        },
      },
      handlers,
    );
    expect(res?.result).toMatchObject({ content: expect.any(Array) });
    const fetchCall = vi.mocked(fetch).mock.calls[0];
    expect(fetchCall?.[0]).toBe('http://localhost:11434/api/chat');
  });

  it('show_model requires name argument', async () => {
    const res = await handleRpcMessage(
      { jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'show_model', arguments: {} } },
      handlers,
    );
    expect(res?.result).toMatchObject({ isError: true });
  });

  it('unknown tool returns isError result', async () => {
    const res = await handleRpcMessage(
      { jsonrpc: '2.0', id: 6, method: 'tools/call', params: { name: 'nope', arguments: {} } },
      handlers,
    );
    expect(res?.result).toMatchObject({ isError: true });
  });

  it('uses OLLAMA_HOST override when set', async () => {
    process.env['OLLAMA_HOST'] = 'http://remote-ollama:9999';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ models: [] }),
      }),
    );
    await handleRpcMessage(
      { jsonrpc: '2.0', id: 7, method: 'tools/call', params: { name: 'list_models', arguments: {} } },
      handlers,
    );
    expect(vi.mocked(fetch)).toHaveBeenCalledWith('http://remote-ollama:9999/api/tags');
  });
});
