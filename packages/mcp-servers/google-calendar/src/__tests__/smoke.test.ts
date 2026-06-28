import { handleRpcMessage } from '@wolfkrow/mcp-shared';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { handlers } from '../handlers';

afterEach(() => vi.unstubAllGlobals());

describe('google-calendar MCP server smoke tests', () => {
  it('initialize handshake returns protocol version and tools capability', async () => {
    const res = await handleRpcMessage({ jsonrpc: '2.0', id: 1, method: 'initialize' }, handlers);
    expect(res?.result).toMatchObject({
      protocolVersion: expect.any(String),
      capabilities: { tools: {} },
    });
  });

  it('tools/list returns calendar_list_events and calendar_create_event', async () => {
    const res = await handleRpcMessage({ jsonrpc: '2.0', id: 2, method: 'tools/list' }, handlers);
    const tools = (res?.result as { tools: { name: string }[] })?.tools ?? [];
    const names = tools.map((t) => t.name);
    expect(names).toContain('calendar_list_events');
    expect(names).toContain('calendar_create_event');
  });

  it('calendar_list_events calls Google Calendar API and returns content', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          items: [
            {
              id: 'evt1',
              summary: 'Team Meeting',
              start: { dateTime: '2026-06-23T10:00:00Z' },
              end: { dateTime: '2026-06-23T11:00:00Z' },
            },
          ],
        }),
      })
    );
    process.env['GOOGLE_CALENDAR_TOKEN'] = 'test-oauth-token';

    const res = await handleRpcMessage(
      {
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: { name: 'calendar_list_events', arguments: { maxResults: 5 } },
      },
      handlers
    );

    expect(res?.result).toMatchObject({
      content: expect.arrayContaining([expect.objectContaining({ type: 'text' })]),
    });
    expect(vi.mocked(fetch)).toHaveBeenCalledOnce();
  });

  it('calendar_create_event calls Google Calendar API and returns created event', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 'new-evt',
          summary: 'New Meeting',
          start: { dateTime: '2026-06-24T14:00:00Z' },
          end: { dateTime: '2026-06-24T15:00:00Z' },
        }),
      })
    );
    process.env['GOOGLE_CALENDAR_TOKEN'] = 'test-oauth-token';

    const res = await handleRpcMessage(
      {
        jsonrpc: '2.0',
        id: 4,
        method: 'tools/call',
        params: {
          name: 'calendar_create_event',
          arguments: {
            summary: 'New Meeting',
            startDateTime: '2026-06-24T14:00:00Z',
            endDateTime: '2026-06-24T15:00:00Z',
          },
        },
      },
      handlers
    );

    expect(res?.result).toMatchObject({
      content: expect.arrayContaining([expect.objectContaining({ type: 'text' })]),
    });
    expect(vi.mocked(fetch)).toHaveBeenCalledOnce();
  });

  it('missing token returns error content', async () => {
    delete process.env['GOOGLE_CALENDAR_TOKEN'];

    const res = await handleRpcMessage(
      {
        jsonrpc: '2.0',
        id: 5,
        method: 'tools/call',
        params: { name: 'calendar_list_events', arguments: {} },
      },
      handlers
    );

    expect(res?.result).toMatchObject({ isError: true });
  });
});
