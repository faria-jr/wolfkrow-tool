import { handleRpcMessage } from '@wolfkrow/mcp-shared';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { handlers } from '../handlers';

afterEach(() => vi.unstubAllGlobals());

describe('youtube MCP server smoke tests', () => {
  it('initialize handshake returns protocol version and tools capability', async () => {
    const res = await handleRpcMessage({ jsonrpc: '2.0', id: 1, method: 'initialize' }, handlers);
    expect(res?.result).toMatchObject({
      protocolVersion: expect.any(String),
      capabilities: { tools: {} },
    });
  });

  it('tools/list returns youtube_search and youtube_get_transcript tools', async () => {
    const res = await handleRpcMessage({ jsonrpc: '2.0', id: 2, method: 'tools/list' }, handlers);
    const tools = (res?.result as { tools: { name: string }[] })?.tools ?? [];
    const names = tools.map((t) => t.name);
    expect(names).toContain('youtube_search');
    expect(names).toContain('youtube_get_transcript');
  });

  it('youtube_search calls YouTube Data API and returns content', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          items: [
            { id: { videoId: 'abc123' }, snippet: { title: 'Test Video', description: 'desc' } },
          ],
        }),
      })
    );
    process.env['YOUTUBE_API_KEY'] = 'test-key';

    const res = await handleRpcMessage(
      {
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: { name: 'youtube_search', arguments: { query: 'node.js' } },
      },
      handlers
    );

    expect(res?.result).toMatchObject({
      content: expect.arrayContaining([expect.objectContaining({ type: 'text' })]),
    });
    expect(vi.mocked(fetch)).toHaveBeenCalledOnce();
  });

  it('youtube_get_transcript extracts transcript from YouTube page', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        text: async () =>
          '<html><body>{"captions":{"playerCaptionsTracklistRenderer":{"captionTracks":[{"baseUrl":"https://www.youtube.com/api/timedtext?v=abc"}]}}}</body></html>',
      })
    );

    const res = await handleRpcMessage(
      {
        jsonrpc: '2.0',
        id: 4,
        method: 'tools/call',
        params: { name: 'youtube_get_transcript', arguments: { videoId: 'abc123' } },
      },
      handlers
    );

    expect(res?.result).toMatchObject({
      content: expect.arrayContaining([expect.objectContaining({ type: 'text' })]),
    });
    expect(vi.mocked(fetch)).toHaveBeenCalledOnce();
  });

  it('unknown tool returns isError result', async () => {
    const res = await handleRpcMessage(
      {
        jsonrpc: '2.0',
        id: 5,
        method: 'tools/call',
        params: { name: 'nonexistent_tool', arguments: {} },
      },
      handlers
    );
    expect(res?.result).toMatchObject({ isError: true });
  });
});
