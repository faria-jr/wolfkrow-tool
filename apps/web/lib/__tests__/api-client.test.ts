/**
 * FE-4 — Contract tests for the typed API client.
 *
 * Each test mocks `fetch` with a payload shaped exactly as the backend route
 * emits it (grounded in the shared schemas in @wolfkrow/shared-types) and
 * asserts the client parses + returns the typed value. A backend shape drift
 * would surface here as a parse failure.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  ApiClientError,
  getUsageSummary,
  listVaultSecrets,
  login,
  searchKnowledge,
} from '../api-client';

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  } as Response;
}

const VALID_UUID = '12345678-1234-4123-8123-123456789012';

describe('FE-4 — api-client contracts', () => {
  afterEach(() => vi.unstubAllGlobals());

  // --- auth/login -----------------------------------------------------------

  describe('login()', () => {
    it('parses a success response', async () => {
      vi.stubGlobal('fetch', async (_url: string, _init: RequestInit) =>
        jsonResponse(200, { status: 'success', userId: VALID_UUID })
      );
      const res = await login({ password: 'pw' });
      expect(res.status).toBe('success');
    });

    it('parses a requires_totp response', async () => {
      vi.stubGlobal('fetch', async () =>
        jsonResponse(200, { status: 'requires_totp', userId: VALID_UUID })
      );
      const res = await login({ password: 'pw' });
      expect(res.status).toBe('requires_totp');
    });

    it('parses a locked (423) response — contract, not error', async () => {
      vi.stubGlobal('fetch', async () =>
        jsonResponse(423, { status: 'locked', lockedUntil: '2026-06-25T00:00:00Z' })
      );
      const res = await login({ password: 'pw' });
      expect(res.status).toBe('locked');
    });

    it('throws ApiClientError on 401', async () => {
      vi.stubGlobal('fetch', async () => jsonResponse(401, { error: 'Invalid credentials' }));
      await expect(login({ password: 'pw' })).rejects.toThrow(ApiClientError);
      await expect(login({ password: 'pw' })).rejects.toMatchObject({ status: 401 });
    });

    it('throws on shape drift (BE returns garbage)', async () => {
      vi.stubGlobal('fetch', async () => jsonResponse(200, { totally: 'unrelated' }));
      await expect(login({ password: 'pw' })).rejects.toThrow(/shape mismatch/);
    });
  });

  // --- usage/summary --------------------------------------------------------

  describe('getUsageSummary()', () => {
    const validSummary = {
      totalInputTokens: 100,
      totalOutputTokens: 50,
      totalCostUSD: 0.005,
      byModel: { 'claude-sonnet': { inputTokens: 100, outputTokens: 50, costUSD: 0.005 } },
      bySource: { chat: { inputTokens: 100, outputTokens: 50, costUSD: 0.005 } },
      byRuntime: { cloud: { inputTokens: 100, outputTokens: 50, costUSD: 0.005 } },
      byDay: [{ day: '2026-06-25', inputTokens: 100, outputTokens: 50, costUSD: 0.005 }],
    };

    it('parses a valid usage summary', async () => {
      vi.stubGlobal('fetch', async () => jsonResponse(200, validSummary));
      const res = await getUsageSummary();
      expect(res.totalInputTokens).toBe(100);
      expect(res.byModel['claude-sonnet']?.costUSD).toBe(0.005);
    });

    it('throws on shape drift (missing byDay)', async () => {
      vi.stubGlobal('fetch', async () =>
        jsonResponse(200, { totalInputTokens: 1, totalOutputTokens: 1, totalCostUSD: 0 })
      );
      await expect(getUsageSummary()).rejects.toThrow(/shape mismatch/);
    });
  });

  // --- knowledge/search -----------------------------------------------------

  describe('searchKnowledge()', () => {
    const validResponse = {
      results: [
        {
          chunkId: VALID_UUID,
          documentId: VALID_UUID,
          content: 'hello world',
          score: 0.92,
          metadata: { sourceType: 'paragraph' },
        },
      ],
      query: 'hello',
    };

    it('parses a valid search response', async () => {
      vi.stubGlobal('fetch', async () => jsonResponse(200, validResponse));
      const res = await searchKnowledge({ query: 'hello' });
      expect(res).toHaveLength(1);
      expect(res[0]?.content).toBe('hello world');
      expect(res[0]?.score).toBe(0.92);
    });

    it('throws on shape drift (result missing content)', async () => {
      const bad = {
        results: [{ chunkId: VALID_UUID, documentId: VALID_UUID, score: 0.9 }],
        query: 'x',
      };
      vi.stubGlobal('fetch', async () => jsonResponse(200, bad));
      await expect(searchKnowledge({ query: 'x' })).rejects.toThrow(/shape mismatch/);
    });
  });

  // --- vault ----------------------------------------------------------------

  describe('listVaultSecrets()', () => {
    const validSecret = {
      id: VALID_UUID,
      userId: VALID_UUID,
      key: 'anthropic-api-key',
      displayName: 'Anthropic',
      category: 'ai',
      metadata: {},
      createdAt: '2026-06-01T00:00:00Z',
      updatedAt: '2026-06-01T00:00:00Z',
    };

    it('parses a valid vault list', async () => {
      vi.stubGlobal('fetch', async () => jsonResponse(200, { secrets: [validSecret] }));
      const res = await listVaultSecrets();
      expect(res).toHaveLength(1);
      expect(res[0]?.key).toBe('anthropic-api-key');
      expect(res[0]?.category).toBe('ai');
    });

    it('throws on shape drift (secrets not an array)', async () => {
      vi.stubGlobal('fetch', async () => jsonResponse(200, { secrets: 'oops' }));
      await expect(listVaultSecrets()).rejects.toThrow(/shape mismatch/);
    });
  });

  // --- chat contract note ---------------------------------------------------
  //
  // Chat (/chat/send) is an SSE stream consumed by components/chat/sse.ts, not
  // a JSON endpoint. Its contract resilience is covered by
  // sse-resilience.test.ts (malformed frame → stream survives).
});
