import { handleRpcMessage } from '@wolfkrow/mcp-shared';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { handlers } from '../handlers';

afterEach(() => vi.unstubAllGlobals());

describe('google-gmail MCP server smoke tests', () => {
  it('initialize handshake returns protocol version and tools capability', async () => {
    const res = await handleRpcMessage({ jsonrpc: '2.0', id: 1, method: 'initialize' }, handlers);
    expect(res?.result).toMatchObject({
      protocolVersion: expect.any(String),
      capabilities: { tools: {} },
    });
  });

  it('tools/list returns gmail_search_messages and gmail_get_message', async () => {
    const res = await handleRpcMessage({ jsonrpc: '2.0', id: 2, method: 'tools/list' }, handlers);
    const tools = (res?.result as { tools: { name: string }[] })?.tools ?? [];
    const names = tools.map((t) => t.name);
    expect(names).toContain('gmail_search_messages');
    expect(names).toContain('gmail_get_message');
  });

  it('gmail_search_messages calls Gmail API and returns content', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        messages: [{ id: 'msg1', threadId: 'thread1' }],
        resultSizeEstimate: 1,
      }),
    }));
    process.env['GOOGLE_GMAIL_TOKEN'] = 'test-oauth-token';

    const res = await handleRpcMessage(
      { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'gmail_search_messages', arguments: { query: 'from:boss@example.com' } } },
      handlers,
    );

    expect(res?.result).toMatchObject({ content: expect.arrayContaining([expect.objectContaining({ type: 'text' })]) });
    expect(vi.mocked(fetch)).toHaveBeenCalledOnce();
  });

  it('gmail_get_message returns message body', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'msg1',
        snippet: 'Hello, this is the email snippet',
        payload: { headers: [{ name: 'Subject', value: 'Test Email' }] },
      }),
    }));
    process.env['GOOGLE_GMAIL_TOKEN'] = 'test-oauth-token';

    const res = await handleRpcMessage(
      { jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'gmail_get_message', arguments: { messageId: 'msg1' } } },
      handlers,
    );

    expect(res?.result).toMatchObject({ content: expect.arrayContaining([expect.objectContaining({ type: 'text' })]) });
    expect(vi.mocked(fetch)).toHaveBeenCalledOnce();
  });

  it('missing token returns error content', async () => {
    delete process.env['GOOGLE_GMAIL_TOKEN'];

    const res = await handleRpcMessage(
      { jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'gmail_search_messages', arguments: { query: 'test' } } },
      handlers,
    );

    expect(res?.result).toMatchObject({ isError: true });
  });
});
