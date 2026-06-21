import { describe, expect, it, vi } from 'vitest';

vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockSdk {
    messages = {
      stream: () => makeFakeStream(['Hel', 'lo'], { input_tokens: 5, output_tokens: 2 }),
    };
  },
}));

import { AnthropicProvider } from '../anthropic';
import { ProviderAIProviderFactory } from '../factory';
import { accumulate, estimateTokens } from '../helpers';
import { MockProvider } from '../mock';
import type { CompletionOptions, StreamChunk } from '../types';

const opts = (prompt: string): CompletionOptions => ({
  model: 'claude-3-5-sonnet-20241022',
  messages: [{ role: 'user', content: prompt }],
});

async function collect(stream: AsyncIterable<StreamChunk>): Promise<StreamChunk[]> {
  const out: StreamChunk[] = [];
  for await (const chunk of stream) out.push(chunk);
  return out;
}

describe('MockProvider', () => {
  it('streams configured chunks then a done chunk with usage', async () => {
    const provider = new MockProvider(['Hel', 'lo']);
    const chunks = await collect(provider.query(opts('hi')));

    expect(chunks.map((c) => c.delta)).toEqual(['Hel', 'lo', '']);
    const last = chunks.at(-1);
    expect(last?.done).toBe(true);
    expect(last?.outputTokens).toBeGreaterThan(0);
  });

  it('complete accumulates content', async () => {
    const result = await new MockProvider(['foo', 'bar']).complete(opts('x'));
    expect(result.content).toBe('foobar');
    expect(result.usage.outputTokens).toBeGreaterThan(0);
  });

  it('countTokens estimates from message length', async () => {
    const tokens = await new MockProvider().countTokens(
      [{ role: 'user', content: 'a'.repeat(40) }],
      'm',
    );
    expect(tokens).toBe(10);
  });
});

describe('helpers', () => {
  it('accumulate joins deltas and captures usage', async () => {
    const result = await accumulate(
      (async function* (): AsyncIterable<StreamChunk> {
        yield { delta: 'a' };
        yield { delta: 'b' };
        yield { delta: '', done: true, inputTokens: 3, outputTokens: 2 };
      })(),
    );
    expect(result.content).toBe('ab');
    expect(result.usage).toEqual({ inputTokens: 3, outputTokens: 2 });
  });

  it('estimateTokens ≈ chars/4', () => {
    expect(estimateTokens('abcdefgh')).toBe(2);
  });
});

describe('ProviderAIProviderFactory', () => {
  const factory = new ProviderAIProviderFactory();

  it('creates mock provider', () => {
    expect(factory.create('mock', 'key')).toBeInstanceOf(MockProvider);
  });

  it('creates anthropic provider', () => {
    expect(factory.create('anthropic', 'key')).toBeInstanceOf(AnthropicProvider);
  });

  it('throws on unknown provider', () => {
    expect(() => factory.create('nope', 'key')).toThrow(/Unsupported/);
  });
});

describe('AnthropicProvider (SDK mocked via top-level vi.mock)', () => {
  it('streams text deltas and final usage', async () => {
    const provider = new AnthropicProvider('key');
    const chunks = await collect(provider.query(opts('hi')));

    expect(chunks.map((c) => c.delta)).toEqual(['Hel', 'lo', '']);
    expect(chunks[2]).toMatchObject({ done: true, inputTokens: 5, outputTokens: 2 });
  });
});

function makeFakeStream(
  parts: string[],
  usage: { input_tokens: number; output_tokens: number },
) {
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
