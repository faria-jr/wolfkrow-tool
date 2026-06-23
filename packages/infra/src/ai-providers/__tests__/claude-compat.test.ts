import { describe, expect, it, vi } from 'vitest';

vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockSdk {
    messages = {
      stream: () => makeFakeStream(['Hel', 'lo'], { input_tokens: 5, output_tokens: 2 }),
    };
  },
}));

import { ClaudeCompatProvider } from '../claude-compat';
import type { CompletionOptions, StreamChunk } from '../types';

const opts = (prompt: string, overrides: Partial<CompletionOptions> = {}): CompletionOptions => ({
  model: 'glm-4.7',
  messages: [{ role: 'user', content: prompt }],
  ...overrides,
});

async function collect(stream: AsyncIterable<StreamChunk>): Promise<StreamChunk[]> {
  const out: StreamChunk[] = [];
  for await (const chunk of stream) out.push(chunk);
  return out;
}

describe('ClaudeCompatProvider', () => {
  it('streams text deltas and final usage for zai preset', async () => {
    const provider = new ClaudeCompatProvider('key', 'zai');
    const chunks = await collect(provider.query(opts('hi')));

    expect(chunks.map((c) => c.delta)).toEqual(['Hel', 'lo', '']);
    expect(chunks[2]).toMatchObject({ done: true, inputTokens: 5, outputTokens: 2 });
  });

  it('complete accumulates streamed content', async () => {
    const provider = new ClaudeCompatProvider('key', 'minimax');
    const result = await provider.complete(opts('hi'));

    expect(result.content).toBe('Hello');
    expect(result.usage).toEqual({ inputTokens: 5, outputTokens: 2 });
  });

  it('throws for unknown preset', () => {
    expect(() => new ClaudeCompatProvider('key', 'unknown')).toThrow('Unknown Claude-compat provider: unknown');
  });

  it('injects image parts into the last user message', async () => {
    const provider = new ClaudeCompatProvider('key', 'moonshot');
    const chunks = await collect(
      provider.query(
        opts('hi', {
          imageParts: [
            { mimeType: 'image/png', data: 'base64data' },
          ],
        }),
      ),
    );

    expect(chunks.map((c) => c.delta)).toEqual(['Hel', 'lo', '']);
  });

  it('countTokens estimates from message length', async () => {
    const provider = new ClaudeCompatProvider('key', 'qwen');
    const tokens = await provider.countTokens([{ role: 'user', content: 'a'.repeat(40) }], 'qwen-max');
    expect(tokens).toBe(10);
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
