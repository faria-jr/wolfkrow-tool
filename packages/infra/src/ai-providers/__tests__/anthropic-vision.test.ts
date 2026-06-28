/**
 * Tests: T21 — AnthropicProvider imageParts → multi-part message (vision blocks).
 */

import { describe, expect, it, vi } from 'vitest';

const capturedMessages: unknown[] = [];

vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropicSdk {
    messages = {
      stream: (params: { messages: unknown[] }) => {
        capturedMessages.length = 0;
        capturedMessages.push(...params.messages);
        return {
          async *[Symbol.asyncIterator]() {
            yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'ok' } };
          },
          async finalMessage() {
            return { usage: { input_tokens: 5, output_tokens: 2 } };
          },
        };
      },
    };
  },
}));

import { AnthropicProvider } from '../anthropic';
import type { CompletionOptions } from '../types';

async function drain(it: AsyncIterable<unknown>): Promise<void> {
  for await (const _chunk of it) {
    /* consume */
  }
}

const baseOpts = (): CompletionOptions => ({
  model: 'claude-3-5-sonnet-20241022',
  messages: [{ role: 'user', content: 'What is this?' }],
});

describe('AnthropicProvider — imageParts (vision)', () => {
  it('builds plain text message when no imageParts', async () => {
    const provider = new AnthropicProvider('test-key');
    await drain(provider.query(baseOpts()));
    expect(capturedMessages).toHaveLength(1);
    const msg = capturedMessages[0] as { role: string; content: unknown };
    expect(msg.role).toBe('user');
    expect(msg.content).toBe('What is this?');
  });

  it('injects image block into last user message when imageParts provided', async () => {
    const provider = new AnthropicProvider('test-key');
    const opts: CompletionOptions = {
      ...baseOpts(),
      imageParts: [{ mimeType: 'image/jpeg', data: 'abc123' }],
    };
    await drain(provider.query(opts));
    expect(capturedMessages).toHaveLength(1);
    const msg = capturedMessages[0] as { role: string; content: unknown[] };
    expect(msg.role).toBe('user');
    expect(Array.isArray(msg.content)).toBe(true);
    const blocks = msg.content as Array<{ type: string }>;
    expect(blocks[0]).toMatchObject({
      type: 'image',
      source: { type: 'base64', media_type: 'image/jpeg', data: 'abc123' },
    });
    expect(blocks[1]).toMatchObject({ type: 'text', text: 'What is this?' });
  });

  it('handles multiple image parts', async () => {
    const provider = new AnthropicProvider('test-key');
    const opts: CompletionOptions = {
      ...baseOpts(),
      imageParts: [
        { mimeType: 'image/png', data: 'd1' },
        { mimeType: 'image/gif', data: 'd2' },
      ],
    };
    await drain(provider.query(opts));
    const msg = capturedMessages[0] as { content: unknown[] };
    const blocks = msg.content as Array<{ type: string }>;
    expect(blocks).toHaveLength(3); // 2 images + 1 text
    expect(blocks[0]).toMatchObject({ type: 'image' });
    expect(blocks[1]).toMatchObject({ type: 'image' });
    expect(blocks[2]).toMatchObject({ type: 'text', text: 'What is this?' });
  });

  it('preserves previous assistant messages and only modifies last user message', async () => {
    const provider = new AnthropicProvider('test-key');
    const opts: CompletionOptions = {
      model: 'claude-3-5-sonnet-20241022',
      messages: [
        { role: 'user', content: 'hello' },
        { role: 'assistant', content: 'hi' },
        { role: 'user', content: 'now look' },
      ],
      imageParts: [{ mimeType: 'image/webp', data: 'webp64' }],
    };
    await drain(provider.query(opts));
    expect(capturedMessages).toHaveLength(3);
    const first = capturedMessages[0] as { content: unknown };
    expect(first.content).toBe('hello'); // unchanged
    const last = capturedMessages[2] as { content: unknown[] };
    expect(Array.isArray(last.content)).toBe(true);
    const blocks = last.content as Array<{ type: string }>;
    expect(blocks[blocks.length - 1]).toMatchObject({ type: 'text', text: 'now look' });
  });
});
