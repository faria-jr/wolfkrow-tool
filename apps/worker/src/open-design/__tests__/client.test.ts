/**
 * Tests: EPIC 4.2c — OpenDesignClient HTTP shaping + response parsing.
 * Daemon transport is mocked; the real daemon smoke (create→list→files) was
 * verified manually against the vendored engine (health 200, project created).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { OpenDesignClient } from '../client';

let originalFetch: typeof globalThis.fetch;

function mockJson(url: string, method: string, body: unknown, status = 200): typeof fetch {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const u = typeof input === 'string' ? input : input.toString();
    if (u.includes(url) && (!init?.method || init.method === method)) {
      return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => body,
        text: async () => String(body),
      } as Response;
    }
    return { ok: false, status: 404, json: async () => ({}), text: async () => '' } as Response;
  }) as unknown as typeof fetch;
}

beforeEach(() => {
  originalFetch = global.fetch;
});
afterEach(() => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe('OpenDesignClient', () => {
  it('GETs /api/health and parses ok+version', async () => {
    global.fetch = mockJson('/api/health', 'GET', { ok: true, version: '0.6.0' });
    const c = new OpenDesignClient('http://127.0.0.1:7456');
    const h = await c.health();
    expect(h).toEqual({ ok: true, version: '0.6.0' });
    expect(vi.mocked(global.fetch).mock.calls[0]?.[0]).toBe('http://127.0.0.1:7456/api/health');
  });

  it('POSTs /api/projects with the create body and returns project+conversationId', async () => {
    global.fetch = mockJson('/api/projects', 'POST', {
      conversationId: 'c1',
      project: {
        id: 'p1',
        name: 'WK',
        skillId: null,
        designSystemId: null,
        metadata: { kind: 'prototype', fidelity: 'high-fidelity', source: 'wolfkrow' },
        createdAt: 1,
        updatedAt: 1,
      },
    });
    const c = new OpenDesignClient('http://127.0.0.1:7456');
    const r = await c.createProject({
      id: 'p1',
      name: 'WK',
      metadata: { kind: 'prototype', fidelity: 'high-fidelity', source: 'wolfkrow' },
    });
    expect(r.conversationId).toBe('c1');
    expect(r.project.id).toBe('p1');
    const init = vi.mocked(global.fetch).mock.calls[0]?.[1] as RequestInit;
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toMatchObject({ id: 'p1', name: 'WK' });
  });

  it('lists projects', async () => {
    global.fetch = mockJson('/api/projects', 'GET', { projects: [{ id: 'p1', name: 'A' }] });
    const c = new OpenDesignClient('http://127.0.0.1:7456');
    expect(await c.listProjects()).toHaveLength(1);
  });

  it('lists project files (empty when none)', async () => {
    global.fetch = mockJson('/files', 'GET', { files: [] });
    const c = new OpenDesignClient('http://127.0.0.1:7456');
    expect(await c.getProjectFiles('p1')).toEqual([]);
  });

  it('fetches a file as text', async () => {
    global.fetch = vi.fn(
      async () =>
        ({
          ok: true,
          status: 200,
          text: async () => '<html></html>',
          json: async () => ({}),
        }) as Response
    ) as unknown as typeof fetch;
    const c = new OpenDesignClient('http://127.0.0.1:7456');
    expect(await c.getProjectFile('p1', 'index.html')).toBe('<html></html>');
    expect(vi.mocked(global.fetch).mock.calls[0]?.[0]).toContain(
      '/api/projects/p1/files/index.html'
    );
  });

  it('throws on non-ok response', async () => {
    global.fetch = vi.fn(
      async () =>
        ({ ok: false, status: 500, json: async () => ({}), text: async () => '' }) as Response
    ) as unknown as typeof fetch;
    const c = new OpenDesignClient('http://127.0.0.1:7456');
    await expect(c.health()).rejects.toThrow('HTTP 500');
  });
});
