import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

// Mutable so individual tests can override the stream factory.
let streamImpl: (...args: unknown[]) => unknown = () =>
  makeFakeStream(['Hel', 'lo'], { input_tokens: 5, output_tokens: 2 });

vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockSdk {
    messages = { stream: (...args: unknown[]) => streamImpl(...args) };
  },
}));

import { ToolResult } from '@wolfkrow/domain';
import { ClaudeCompatProvider } from '../claude-compat';
import { ToolRegistry } from '../../tools/tool-registry';
import type { CompletionOptions, StreamChunk } from '../types';
import type { ToolExecutor, ToolExecutionContext } from '@wolfkrow/domain';

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
  afterEach(() => {
    streamImpl = () => makeFakeStream(['Hel', 'lo'], { input_tokens: 5, output_tokens: 2 });
  });

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

describe('ClaudeCompatProvider — tool-calling (RM3.1)', () => {
  beforeEach(() => {
    // First call returns tool_use stream; second returns final text.
    let callCount = 0;
    streamImpl = () => {
      callCount++;
      return callCount === 1
        ? makeToolStream('echo', 'tid-1', { msg: 'hi' }, { input_tokens: 10, output_tokens: 5 })
        : makeFakeStream(['Done'], { input_tokens: 3, output_tokens: 1 });
    };
  });

  afterEach(() => {
    streamImpl = () => makeFakeStream(['Hel', 'lo'], { input_tokens: 5, output_tokens: 2 });
  });

  it('accepts URL string as baseUrl when supportsTools given', () => {
    const registry = makeEchoRegistry();
    expect(
      () => new ClaudeCompatProvider('key', 'https://api.z.ai/api/anthropic', true, registry),
    ).not.toThrow();
  });

  it('emits tool_call chunk on tool_use block', async () => {
    const registry = makeEchoRegistry();
    const provider = new ClaudeCompatProvider('key', 'https://api.z.ai/api/anthropic', true, registry);
    const chunks = await collect(provider.query(opts('use echo')));
    expect(chunks.some((c) => c.toolCall?.name === 'echo')).toBe(true);
  });

  it('emits tool_result chunk after tool execution', async () => {
    const registry = makeEchoRegistry();
    const provider = new ClaudeCompatProvider('key', 'https://api.z.ai/api/anthropic', true, registry);
    const chunks = await collect(provider.query(opts('use echo')));
    expect(chunks.some((c) => c.toolResult !== undefined)).toBe(true);
  });

  it('continues to text after tool loop completes', async () => {
    const registry = makeEchoRegistry();
    const provider = new ClaudeCompatProvider('key', 'https://api.z.ai/api/anthropic', true, registry);
    const chunks = await collect(provider.query(opts('use echo')));
    const textDeltas = chunks.filter((c) => c.delta && c.delta.length > 0 && !c.done);
    expect(textDeltas.length).toBeGreaterThan(0);
  });

  it('text-only mode unchanged when no registry', async () => {
    streamImpl = () => makeFakeStream(['Hi'], { input_tokens: 2, output_tokens: 1 });
    const provider = new ClaudeCompatProvider('key', 'zai');
    const chunks = await collect(provider.query(opts('hi')));
    expect(chunks.map((c) => c.delta)).toEqual(['Hi', '']);
  });
});

// --- helpers ---

function makeEchoRegistry(): ToolRegistry {
  const echo: ToolExecutor = {
    name: 'echo',
    description: 'Echo input',
    inputSchema: { type: 'object', properties: { msg: { type: 'string' } } },
    async execute(input: Record<string, unknown>, _ctx: ToolExecutionContext) {
      return ToolResult.ok('echo-call', String(input['msg'] ?? ''));
    },
  };
  return new ToolRegistry([echo]);
}

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
      return { content: [], stop_reason: 'end_turn', usage };
    },
  };
}

function makeToolStream(
  toolName: string,
  toolId: string,
  input: Record<string, unknown>,
  usage: { input_tokens: number; output_tokens: number },
) {
  return {
    async *[Symbol.asyncIterator]() {
      yield { type: 'content_block_start', content_block: { type: 'tool_use', id: toolId, name: toolName } };
      yield { type: 'content_block_delta', delta: { type: 'input_json_delta', partial_json: JSON.stringify(input) } };
      yield { type: 'content_block_stop' };
    },
    async finalMessage() {
      return {
        content: [{ type: 'tool_use', id: toolId, name: toolName, input }],
        stop_reason: 'tool_use',
        usage,
      };
    },
  };
}
