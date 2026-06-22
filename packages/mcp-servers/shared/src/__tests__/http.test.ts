import { afterEach, describe, expect, it, vi } from 'vitest';

import { createWorkerClient } from '../http';

const originalToken = process.env['WOLFKROW_AUTH_TOKEN'];
const originalUrl = process.env['WOLFKROW_WORKER_URL'];

afterEach(() => {
  if (originalToken === undefined) delete process.env['WOLFKROW_AUTH_TOKEN'];
  else process.env['WOLFKROW_AUTH_TOKEN'] = originalToken;
  if (originalUrl === undefined) delete process.env['WOLFKROW_WORKER_URL'];
  else process.env['WOLFKROW_WORKER_URL'] = originalUrl;
  vi.unstubAllGlobals();
});

describe('createWorkerClient', () => {
  it('throws a clear error when no auth token is configured', async () => {
    delete process.env['WOLFKROW_AUTH_TOKEN'];
    const client = createWorkerClient({ baseUrl: 'http://localhost:4000' });
    await expect(client.get('/skills')).rejects.toThrow(/WOLFKROW_AUTH_TOKEN/);
  });

  it('sends GET with an Authorization: Bearer header', async () => {
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => ({
      ok: true,
      status: 200,
      json: async () => ({ ok: 1 }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    const client = createWorkerClient({ authToken: 'TKN', baseUrl: 'http://localhost:4000/' });
    const result = await client.get('/skills');

    expect(result).toEqual({ ok: 1 });
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:4000/skills',
      expect.objectContaining({ headers: expect.any(Headers) }),
    );
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect((init.headers as Headers).get('Authorization')).toBe('Bearer TKN');
  });

  it('POSTs a JSON body with Content-Type application/json', async () => {
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => ({
      ok: true,
      status: 200,
      json: async () => ({}),
    }));
    vi.stubGlobal('fetch', fetchMock);

    const client = createWorkerClient({ authToken: 'T', baseUrl: 'http://localhost:4000' });
    await client.post('/knowledge/search', { query: 'hi' });

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(init.method).toBe('POST');
    expect(init.body).toBe(JSON.stringify({ query: 'hi' }));
    expect((init.headers as Headers).get('Content-Type')).toBe('application/json');
  });

  it('throws on a non-ok response, surfacing status + body', async () => {
    vi.stubGlobal('fetch', async () => ({ ok: false, status: 401, json: async () => ({ error: 'no' }) }));
    const client = createWorkerClient({ authToken: 'T', baseUrl: 'http://localhost:4000' });
    await expect(client.get('/x')).rejects.toThrow(/401/);
  });
});
