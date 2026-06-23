/**
 * Tests: A.2 providers — ClaudeAgentProvider, ClaudeCompatProvider, CodexProvider, LionProvider
 */

import { describe, expect, it, vi } from 'vitest';

vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropicSdk {
    messages = {
      stream: () => makeFakeAnthropicStream(['Agent', ' reply'], { input_tokens: 10, output_tokens: 5 }),
    };
  },
}));

vi.mock('openai', () => ({
  default: class MockOpenAISdk {
    chat = {
      completions: {
        create: async () => makeFakeOpenAIStream(['Codex', ' reply'], 8, 4),
      },
    };
  },
}));

import { AnthropicProvider } from '../anthropic';
import { ClaudeAgentProvider } from '../claude-agent';
import { ClaudeCompatProvider } from '../claude-compat';
import { CodexProvider } from '../codex';
import { ProviderAIProviderFactory } from '../factory';
import { LionProvider } from '../lion';
import { MockProvider } from '../mock';
import type { CompletionOptions, StreamChunk } from '../types';

const opts = (model: string, prompt = 'hi'): CompletionOptions => ({
  model,
  messages: [{ role: 'user', content: prompt }],
});

async function collect(stream: AsyncIterable<StreamChunk>): Promise<StreamChunk[]> {
  const out: StreamChunk[] = [];
  for await (const chunk of stream) out.push(chunk);
  return out;
}

describe('ClaudeAgentProvider', () => {
  it('streams text chunks and done with usage', async () => {
    const provider = new ClaudeAgentProvider('key');
    const chunks = await collect(provider.query(opts('claude-3-5-sonnet-20241022')));

    const text = chunks.filter((c) => c.delta !== '').map((c) => c.delta).join('');
    expect(text).toBe('Agent reply');
    const last = chunks.at(-1);
    expect(last?.done).toBe(true);
    expect(last?.inputTokens).toBe(10);
    expect(last?.outputTokens).toBe(5);
  });

  it('complete returns accumulated content', async () => {
    const result = await new ClaudeAgentProvider('key').complete(opts('claude-3-5-sonnet-20241022'));
    expect(result.content).toBe('Agent reply');
  });

  it('accepts empty registry (no tools)', () => {
    expect(() => new ClaudeAgentProvider('key')).not.toThrow();
  });
});

describe('ClaudeCompatProvider', () => {
  it('streams chunks via OpenAI SDK', async () => {
    const provider = new ClaudeCompatProvider('key');
    const chunks = await collect(provider.query(opts('claude-3-5-sonnet-20241022')));

    const text = chunks.filter((c) => c.delta !== '').map((c) => c.delta).join('');
    expect(text).toBe('Codex reply');
    const done = chunks.find((c) => c.done);
    expect(done).toBeDefined();
  });

  it('complete accumulates content', async () => {
    const result = await new ClaudeCompatProvider('key').complete(opts('claude-3-5-sonnet-20241022'));
    expect(result.content).toBe('Codex reply');
  });
});

describe('CodexProvider', () => {
  it('streams OpenAI chunks', async () => {
    const provider = new CodexProvider('key');
    const chunks = await collect(provider.query(opts('gpt-4o')));

    const text = chunks.filter((c) => c.delta !== '').map((c) => c.delta).join('');
    expect(text).toBe('Codex reply');
  });

  it('accepts custom baseURL for Ollama', () => {
    expect(() => new CodexProvider('ollama', 'http://localhost:11434/v1')).not.toThrow();
  });

  it('complete accumulates and returns usage', async () => {
    const result = await new CodexProvider('key').complete(opts('gpt-4o'));
    expect(result.content).toBe('Codex reply');
    expect(result.usage.inputTokens).toBe(8);
    expect(result.usage.outputTokens).toBe(4);
  });
});

describe('LionProvider', () => {
  it('routes claude-* to AnthropicProvider', async () => {
    const lion = new LionProvider({ anthropicApiKey: 'key' });
    const chunks = await collect(lion.query(opts('claude-3-5-sonnet-20241022')));
    const text = chunks.filter((c) => c.delta !== '').map((c) => c.delta).join('');
    expect(text).toBe('Agent reply');
  });

  it('routes gpt-* to CodexProvider', async () => {
    const lion = new LionProvider({ openaiApiKey: 'key' });
    const chunks = await collect(lion.query(opts('gpt-4o')));
    const text = chunks.filter((c) => c.delta !== '').map((c) => c.delta).join('');
    expect(text).toBe('Codex reply');
  });

  it('routes llama-* to Ollama (CodexProvider with local URL)', async () => {
    const lion = new LionProvider({ ollamaBaseUrl: 'http://localhost:11434/v1' });
    const chunks = await collect(lion.query(opts('llama-3.2')));
    const text = chunks.filter((c) => c.delta !== '').map((c) => c.delta).join('');
    expect(text).toBe('Codex reply');
  });

  it('throws when anthropicApiKey missing for claude-* model', () => {
    const lion = new LionProvider({});
    expect(() => lion.query(opts('claude-3-5-sonnet-20241022'))).toThrow(/anthropicApiKey/);
  });

  it('throws when openaiApiKey missing for gpt-* model', () => {
    const lion = new LionProvider({});
    expect(() => lion.query(opts('gpt-4o'))).toThrow(/openaiApiKey/);
  });

  it('throws for unsupported gemini-* model', () => {
    const lion = new LionProvider({});
    expect(() => lion.query(opts('gemini-pro'))).toThrow(/Google GenAI/);
  });

  it('throws for completely unknown model', () => {
    const lion = new LionProvider({});
    expect(() => lion.query(opts('unknown-model-xyz'))).toThrow(/unknown model prefix/);
  });
});

describe('ProviderAIProviderFactory — A.2 providers', () => {
  const factory = new ProviderAIProviderFactory();

  it('creates claude-agent provider', () => {
    expect(factory.create('claude-agent', 'key')).toBeInstanceOf(ClaudeAgentProvider);
  });

  it('creates claude-compat provider', () => {
    expect(factory.create('claude-compat', 'key')).toBeInstanceOf(ClaudeCompatProvider);
  });

  it('creates codex provider', () => {
    expect(factory.create('codex', 'key')).toBeInstanceOf(CodexProvider);
  });

  it('aliases openai → codex', () => {
    expect(factory.create('openai', 'key')).toBeInstanceOf(CodexProvider);
  });

  it('creates lion provider', () => {
    expect(factory.create('lion', 'key')).toBeInstanceOf(LionProvider);
  });

  it('creates ollama provider (CodexProvider)', () => {
    expect(factory.create('ollama', 'key')).toBeInstanceOf(CodexProvider);
  });

  it('still throws on truly unknown provider', () => {
    expect(() => factory.create('banana', 'key')).toThrow(/Unsupported/);
  });

  it('existing providers still work', () => {
    expect(factory.create('anthropic', 'key')).toBeInstanceOf(AnthropicProvider);
    expect(factory.create('mock', 'key')).toBeInstanceOf(MockProvider);
  });
});

function makeFakeAnthropicStream(parts: string[], usage: { input_tokens: number; output_tokens: number }) {
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

async function* makeFakeOpenAIStream(parts: string[], promptTokens: number, completionTokens: number) {
  for (const content of parts) {
    yield { choices: [{ delta: { content }, finish_reason: null }], usage: null };
  }
  yield {
    choices: [{ delta: {}, finish_reason: 'stop' }],
    usage: { prompt_tokens: promptTokens, completion_tokens: completionTokens },
  };
}
