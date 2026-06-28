import { ProviderConfig, ToolResult } from '@wolfkrow/domain';
import type { ToolExecutionContext, ToolExecutor } from '@wolfkrow/domain';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ToolRegistry } from '../../tools/tool-registry';
import { AnthropicProvider } from '../anthropic';
import { ClaudeCompatProvider } from '../claude-compat';
import { CodexProvider } from '../codex';
import { ProviderAIProviderFactory } from '../factory';
import { accumulate, estimateTokens } from '../helpers';
import { MockProvider } from '../mock';
import type { CompletionOptions, StreamChunk } from '../types';

// P1-8: mutable stream factory so tool_use tests can swap the SDK response.
let streamImpl: (...args: unknown[]) => unknown = () =>
  makeFakeStream(['Hel', 'lo'], { input_tokens: 5, output_tokens: 2 });

vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockSdk {
    messages = {
      stream: (...args: unknown[]) => streamImpl(...args),
    };
  },
}));

afterEach(() => {
  streamImpl = () => makeFakeStream(['Hel', 'lo'], { input_tokens: 5, output_tokens: 2 });
});

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
      'm'
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
      })()
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

  it('creates claude-compat provider with preset prefix', () => {
    expect(factory.create('claude-compat:zai', 'key')).toBeInstanceOf(ClaudeCompatProvider);
    expect(factory.create('claude-compat:qwen', 'key')).toBeInstanceOf(ClaudeCompatProvider);
  });

  it('throws when claude-compat is used without a preset suffix', () => {
    expect(() => factory.create('claude-compat', 'key')).toThrow(/preset suffix/);
  });

  it('throws on unknown provider', () => {
    expect(() => factory.create('nope', 'key')).toThrow(/Unsupported/);
  });

  it('createFromConfig creates ClaudeCompatProvider for anthropic-compat protocol', () => {
    const cfg = ProviderConfig.create({
      id: 'zai',
      displayName: 'Z',
      protocol: 'anthropic-compat',
      baseUrl: 'https://api.z.ai/api/anthropic',
      apiKeyAccount: 'zai',
      models: ['glm-4.7'],
      supportsTools: true,
    });
    expect(factory.createFromConfig(cfg, 'key')).toBeInstanceOf(ClaudeCompatProvider);
  });

  it('createFromConfig creates CodexProvider for openai-compatible protocol', () => {
    const cfg = ProviderConfig.create({
      id: 'openai',
      displayName: 'OAI',
      protocol: 'openai-compatible',
      baseUrl: 'https://api.openai.com/v1',
      apiKeyAccount: 'openai',
      models: ['gpt-4o'],
      supportsTools: true,
    });
    expect(factory.createFromConfig(cfg, 'key')).toBeInstanceOf(CodexProvider);
  });
});

// P1-8: claude-compat providers created via factory.create (the non-agentic
// path used by OrchestratorService) MUST thread the toolRegistry through, so
// that a tool_use response actually executes the tool instead of being
// silently drained as text.
describe('ProviderAIProviderFactory — claude-compat tool wiring (P1-8)', () => {
  const opts = (prompt: string): CompletionOptions => ({
    model: 'glm-4.7',
    messages: [{ role: 'user', content: prompt }],
  });

  function makeToolStream(
    toolName: string,
    toolId: string,
    input: Record<string, unknown>,
    usage: { input_tokens: number; output_tokens: number }
  ) {
    return {
      async *[Symbol.asyncIterator]() {
        yield {
          type: 'content_block_start',
          content_block: { type: 'tool_use', id: toolId, name: toolName },
        };
        yield {
          type: 'content_block_delta',
          delta: { type: 'input_json_delta', partial_json: JSON.stringify(input) },
        };
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

  function makeTextStream(parts: string[], usage: { input_tokens: number; output_tokens: number }) {
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

  it('create(claude-compat:*) executes a tool when a toolRegistry is provided', async () => {
    const executeSpy = vi.fn(async (_input: Record<string, unknown>, _ctx: ToolExecutionContext) =>
      ToolResult.ok('tid-1', 'ran')
    );
    const registry = new ToolRegistry([
      {
        name: 'echo',
        description: 'echo',
        inputSchema: { type: 'object', properties: { msg: { type: 'string' } } },
        execute: executeSpy as ToolExecutor['execute'],
      } satisfies ToolExecutor,
    ]);
    const factoryWithTools = new ProviderAIProviderFactory(registry);

    // 1st turn → tool_use; 2nd turn → final text.
    let callCount = 0;
    streamImpl = () => {
      callCount++;
      return callCount === 1
        ? makeToolStream('echo', 'tid-1', { msg: 'hi' }, { input_tokens: 10, output_tokens: 5 })
        : makeTextStream(['Done'], { input_tokens: 3, output_tokens: 1 });
    };

    const provider = factoryWithTools.create('claude-compat:zai', 'key');
    expect(provider).toBeInstanceOf(ClaudeCompatProvider);

    const chunks: StreamChunk[] = [];
    for await (const c of provider.query(opts('use echo'))) chunks.push(c);

    // The tool MUST have been invoked — this fails before the fix because the
    // registry was dropped, so the provider took the text-only branch.
    expect(executeSpy).toHaveBeenCalledTimes(1);
    expect(chunks.some((c) => c.toolCall?.name === 'echo')).toBe(true);
    expect(chunks.some((c) => c.toolResult?.output === 'ran')).toBe(true);
  });

  it('create(claude-compat:*) without a registry stays text-only (no behavior regression)', async () => {
    streamImpl = () => makeTextStream(['Hi'], { input_tokens: 2, output_tokens: 1 });
    const bareFactory = new ProviderAIProviderFactory();
    const provider = bareFactory.create('claude-compat:zai', 'key');
    const chunks: StreamChunk[] = [];
    for await (const c of provider.query(opts('hi'))) chunks.push(c);
    expect(chunks.map((c) => c.delta)).toEqual(['Hi', '']);
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
