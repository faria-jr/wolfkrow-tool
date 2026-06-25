import { afterEach, describe, expect, it, vi } from 'vitest';

import { AnthropicHyde } from '../hyde/anthropic-hyde';
import { NoOpHyde } from '../hyde/noop-hyde';
import { CohereReranker } from '../rerankers/cohere-reranker';
import { NoOpReranker } from '../rerankers/noop-reranker';

afterEach(() => vi.unstubAllGlobals());

function mockFetch(json: unknown, ok = true): typeof fetch {
  return vi.fn().mockResolvedValue({
    ok,
    json: async () => json,
  }) as unknown as typeof fetch;
}

describe('CohereReranker', () => {
  it('returns rerank hits from the API', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch({ results: [{ index: 1, relevance_score: 0.9 }, { index: 0, relevance_score: 0.4 }] }),
    );
    const r = new CohereReranker('key');
    const hits = await r.rerank('q', ['a', 'b'], 2);
    expect(hits).toEqual([
      { index: 1, score: 0.9 },
      { index: 0, score: 0.4 },
    ]);
  });

  it('returns [] when the API fails', async () => {
    vi.stubGlobal('fetch', mockFetch({}, false));
    const r = new CohereReranker('key');
    expect(await r.rerank('q', ['a'], 1)).toEqual([]);
  });

  it('returns [] when fetch throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));
    expect(await new CohereReranker('key').rerank('q', ['a'], 1)).toEqual([]);
  });

  it('returns [] for empty documents', async () => {
    const r = new CohereReranker('key');
    expect(await r.rerank('q', [], 1)).toEqual([]);
  });
});

describe('NoOpReranker', () => {
  it('is disabled and preserves order', async () => {
    const r = new NoOpReranker();
    expect(r.enabled).toBe(false);
    expect(await r.rerank('q', ['a', 'b', 'c'], 2)).toEqual([
      { index: 0, score: 0 },
      { index: 1, score: 0 },
    ]);
  });
});

describe('AnthropicHyde', () => {
  it('returns the generated hypothetical text', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch({ content: [{ type: 'text', text: 'hypothetical doc' }] }),
    );
    const h = new AnthropicHyde('key');
    expect(await h.generate('query')).toBe('hypothetical doc');
  });

  it('returns null when the API fails', async () => {
    vi.stubGlobal('fetch', mockFetch({}, false));
    expect(await new AnthropicHyde('key').generate('q')).toBeNull();
  });

  it('returns null when fetch throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('boom')));
    expect(await new AnthropicHyde('key').generate('q')).toBeNull();
  });
});

describe('NoOpHyde', () => {
  it('is disabled and returns null', async () => {
    const h = new NoOpHyde();
    expect(h.enabled).toBe(false);
    expect(await h.generate('q')).toBeNull();
  });
});
