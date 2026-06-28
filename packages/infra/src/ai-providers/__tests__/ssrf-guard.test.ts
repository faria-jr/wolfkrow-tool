import * as dns from 'node:dns';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { ClaudeCompatProvider } from '../claude-compat';
import { CodexProvider } from '../codex';
import { assertPublicProviderHost } from '../ssrf-guard';
import type { CompletionOptions } from '../types';

vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockSdk {
    messages = { stream: () => makeFakeStream(['x'], { input_tokens: 1, output_tokens: 1 }) };
  },
}));

vi.mock('openai', () => ({
  default: class MockOpenAI {
    chat = {
      completions: {
        create: async function* (): AsyncIterable<unknown> {
          yield {};
        },
      },
    };
  },
}));

function makeFakeStream(parts: string[], usage: { input_tokens: number; output_tokens: number }) {
  const events = parts.map((text) => ({
    type: 'content_block_delta' as const,
    delta: { type: 'text_delta' as const, text },
  }));
  return {
    async *[Symbol.asyncIterator]() {
      for (const event of events) yield event;
    },
    async finalMessage() {
      return { usage };
    },
  };
}

const opts = (prompt: string): CompletionOptions => ({
  model: 'm',
  messages: [{ role: 'user', content: prompt }],
});

/**
 * Mock `dns.promises.lookup` to resolve an array of LookupAddress. The real
 * `lookup` is overloaded (single vs `{ all: true }`); the spy's inferred type
 * targets the single-record return, so we cast to satisfy the overload while
 * the runtime contract matches the `{ all: true }` path used by the guard.
 */
function mockLookupAll(
  spy: ReturnType<typeof vi.spyOn<any, any>>, // eslint-disable-line @typescript-eslint/no-explicit-any
  records: dns.LookupAddress[]
): void {
  spy.mockResolvedValue(records as never);
}

describe('assertPublicProviderHost (DNS rebind revalidation)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('passes when DNS resolves to a public IP', async () => {
    mockLookupAll(vi.spyOn(dns.promises, 'lookup'), [{ address: '8.8.8.8', family: 4 }]);
    await expect(assertPublicProviderHost('https://api.example.com/v1')).resolves.toBeUndefined();
  });

  it('rejects when DNS resolves to loopback 127.0.0.1 (rebind)', async () => {
    mockLookupAll(vi.spyOn(dns.promises, 'lookup'), [{ address: '127.0.0.1', family: 4 }]);
    await expect(assertPublicProviderHost('https://api.example.com/v1')).rejects.toThrow(/SSRF/);
  });

  it('rejects when DNS resolves to cloud metadata 169.254.169.254', async () => {
    mockLookupAll(vi.spyOn(dns.promises, 'lookup'), [{ address: '169.254.169.254', family: 4 }]);
    await expect(assertPublicProviderHost('https://rebind.example.com/v1')).rejects.toThrow(/SSRF/);
  });

  it('rejects when DNS resolves to private 10.x', async () => {
    mockLookupAll(vi.spyOn(dns.promises, 'lookup'), [{ address: '10.0.0.5', family: 4 }]);
    await expect(assertPublicProviderHost('https://internal.example.com/v1')).rejects.toThrow(
      /SSRF/
    );
  });

  it('skips DNS lookup for literal loopback hostnames (localhost) — allowed for dev', async () => {
    const spy = vi.spyOn(dns.promises, 'lookup');
    await expect(assertPublicProviderHost('http://localhost:11434/v1')).resolves.toBeUndefined();
    expect(spy).not.toHaveBeenCalled();
  });

  it('skips DNS lookup for literal IP hostnames (already validated at config time)', async () => {
    const spy = vi.spyOn(dns.promises, 'lookup');
    await expect(assertPublicProviderHost('https://8.8.8.8/v1')).resolves.toBeUndefined();
    expect(spy).not.toHaveBeenCalled();
  });

  it('treats DNS lookup failure as non-fatal (resolves to pass) — avoids DoS via NXDOMAIN', async () => {
    vi.spyOn(dns.promises, 'lookup').mockRejectedValue(new Error('ENOTFOUND'));
    await expect(
      assertPublicProviderHost('https://unknown.example.com/v1')
    ).resolves.toBeUndefined();
  });

  it('rejects when ANY resolved address is private (round-robin DNS defense)', async () => {
    // Round-robin: one public, one private. Must reject because the connection
    // could be routed to the private address among the returned set.
    mockLookupAll(vi.spyOn(dns.promises, 'lookup'), [
      { address: '8.8.8.8', family: 4 },
      { address: '10.0.0.5', family: 4 },
    ]);
    await expect(assertPublicProviderHost('https://rr.example.com/v1')).rejects.toThrow(/SSRF/);
  });

  it('passes when ALL resolved addresses are public', async () => {
    mockLookupAll(vi.spyOn(dns.promises, 'lookup'), [
      { address: '8.8.8.8', family: 4 },
      { address: '1.1.1.1', family: 4 },
    ]);
    await expect(assertPublicProviderHost('https://rr.example.com/v1')).resolves.toBeUndefined();
  });
});

describe('ClaudeCompatProvider — SSRF rebind rejection at query time', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects first query when custom baseUrl host resolves to private IP', async () => {
    mockLookupAll(vi.spyOn(dns.promises, 'lookup'), [{ address: '169.254.169.254', family: 4 }]);
    const provider = new ClaudeCompatProvider('key', { baseUrl: 'https://rebind.example.com/v1' });
    await expect(async () => {
      for await (const _chunk of provider.query(opts('hi'))) void _chunk;
    }).rejects.toThrow(/SSRF/);
  });

  it('allows query when custom baseUrl host resolves to public IP', async () => {
    mockLookupAll(vi.spyOn(dns.promises, 'lookup'), [{ address: '8.8.8.8', family: 4 }]);
    const provider = new ClaudeCompatProvider('key', { baseUrl: 'https://api.example.com/v1' });
    const chunks = [];
    for await (const chunk of provider.query(opts('hi'))) chunks.push(chunk);
    expect(chunks.length).toBeGreaterThan(0);
  });

  it('performs DNS check only once across multiple queries', async () => {
    const spy = vi.spyOn(dns.promises, 'lookup');
    mockLookupAll(spy, [{ address: '8.8.8.8', family: 4 }]);
    const provider = new ClaudeCompatProvider('key', { baseUrl: 'https://api.example.com/v1' });
    for await (const _c of provider.query(opts('a'))) void _c;
    for await (const _c of provider.query(opts('b'))) void _c;
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('shares the in-flight DNS promise across concurrent queries (no race bypass)', async () => {
    // Construct a controlled promise that stays pending until we resolve it.
    // Two queries are kicked off concurrently BEFORE the DNS lookup resolves.
    let releaseLookup: () => void = () => {};
    let lookupResolved = false;
    const pendingLookup = new Promise<dns.LookupAddress[]>((resolve) => {
      releaseLookup = () => {
        lookupResolved = true;
        resolve([{ address: '8.8.8.8', family: 4 }]);
      };
    });
    const spy = vi.spyOn(dns.promises, 'lookup').mockReturnValue(pendingLookup as never);
    const provider = new ClaudeCompatProvider('key', { baseUrl: 'https://api.example.com/v1' });

    // Track whether each query reaches completion (the SDK stream) before the
    // DNS guard resolves. Under the promise-sharing fix, both MUST block until
    // the lookup resolves. A boolean-caching race (old code) would let the
    // second caller bypass the await and complete early.
    let queriesCompleted = 0;
    const track = <T>(p: Promise<T>): Promise<T> =>
      p.then((v) => {
        queriesCompleted++;
        return v;
      });

    // Kick off two concurrent queries while the DNS lookup is still pending.
    const p1 = track(
      (async () => {
        for await (const _c of provider.query(opts('a'))) void _c;
      })()
    );
    const p2 = track(
      (async () => {
        for await (const _c of provider.query(opts('b'))) void _c;
      })()
    );

    // Flush the microtask queue so both callers have reached their await on the
    // shared DNS promise. Neither may complete while the lookup is pending.
    // Flush the microtask queue generously so both callers have reached their
    // await on the shared DNS promise AND, under a buggy boolean-caching impl,
    // the bypassing caller would have drained its SDK stream. Neither may
    // complete while the lookup is pending under the promise-sharing fix.
    for (let i = 0; i < 50; i++) await Promise.resolve();

    // The guard has been invoked exactly once (shared promise), and neither
    // query has proceeded to the SDK stream yet because the lookup is unresolved.
    expect(spy).toHaveBeenCalledTimes(1);
    expect(lookupResolved).toBe(false);
    expect(queriesCompleted).toBe(0);

    releaseLookup();
    await Promise.all([p1, p2]);

    // Still exactly one lookup — the second concurrent caller awaited the same
    // promise rather than bypassing the guard or re-resolving DNS.
    expect(spy).toHaveBeenCalledTimes(1);
    expect(queriesCompleted).toBe(2);
  });
});

describe('CodexProvider — SSRF rebind rejection at query time', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects first query when custom baseURL host resolves to private IP', async () => {
    mockLookupAll(vi.spyOn(dns.promises, 'lookup'), [{ address: '10.0.0.5', family: 4 }]);
    const provider = new CodexProvider('key', 'https://rebind.example.com/v1');
    await expect(async () => {
      for await (const _chunk of provider.query(opts('hi'))) void _chunk;
    }).rejects.toThrow(/SSRF/);
  });
});
