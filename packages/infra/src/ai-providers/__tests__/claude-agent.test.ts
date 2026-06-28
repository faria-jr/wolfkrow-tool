import type { ToolExecutionContext, ToolExecutor } from '@wolfkrow/domain';
import { ToolResult } from '@wolfkrow/domain';
import { PermissionResolver } from '@wolfkrow/domain';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { BashTool } from '../../tools/bash-tool';
import { ToolRegistry } from '../../tools/tool-registry';
import { ClaudeAgentProvider } from '../claude-agent';
import type { StreamChunk } from '../types';

const { streamMock } = vi.hoisted(() => ({ streamMock: vi.fn() }));

vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    messages = { stream: streamMock };
  },
}));

async function collect(stream: AsyncIterable<StreamChunk>): Promise<StreamChunk[]> {
  const out: StreamChunk[] = [];
  for await (const c of stream) out.push(c);
  return out;
}

function makeTextStream(
  texts: string[],
  stopReason = 'end_turn',
  usage = { input_tokens: 5, output_tokens: 3 }
) {
  return {
    async *[Symbol.asyncIterator]() {
      for (const text of texts) {
        yield { type: 'content_block_delta', delta: { type: 'text_delta', text } };
      }
    },
    finalMessage: async () => ({
      usage,
      stop_reason: stopReason,
      content: texts.length > 0 ? [{ type: 'text', text: texts.join('') }] : [],
    }),
  };
}

function makeToolUseStream(
  toolCalls: { id: string; name: string; input: Record<string, unknown> }[],
  usage = { input_tokens: 10, output_tokens: 5 }
) {
  return {
    async *[Symbol.asyncIterator]() {
      for (const tc of toolCalls) {
        yield {
          type: 'content_block_start',
          content_block: { type: 'tool_use', id: tc.id, name: tc.name },
        };
        yield {
          type: 'content_block_delta',
          delta: { type: 'input_json_delta', partial_json: JSON.stringify(tc.input) },
        };
        yield { type: 'content_block_stop' };
      }
    },
    finalMessage: async () => ({
      usage,
      stop_reason: 'tool_use',
      content: toolCalls.map((tc) => ({
        type: 'tool_use',
        id: tc.id,
        name: tc.name,
        input: tc.input,
      })),
    }),
  };
}

function makeAbortingStream(texts: string[]) {
  return {
    async *[Symbol.asyncIterator]() {
      for (const text of texts) {
        yield { type: 'content_block_delta', delta: { type: 'text_delta', text } };
      }
      const err = new Error('Request was aborted.');
      err.name = 'AbortError';
      throw err;
    },
    finalMessage: async () => ({
      usage: { input_tokens: 5, output_tokens: 3 },
      stop_reason: 'end_turn',
      content: [],
    }),
  };
}

const opts = { model: 'm', messages: [{ role: 'user' as const, content: 'hi' }] };

describe('ClaudeAgentProvider', () => {
  beforeEach(() => {
    streamMock.mockClear();
  });
  it('streams text deltas and done chunk (no tools called)', async () => {
    streamMock.mockReturnValueOnce(makeTextStream(['Hello', ' world']));
    const provider = new ClaudeAgentProvider('key');
    const chunks = await collect(provider.query(opts));

    const textOut = chunks
      .filter((c) => c.delta && !c.done)
      .map((c) => c.delta)
      .join('');
    expect(textOut).toBe('Hello world');
    expect(chunks.at(-1)?.done).toBe(true);
  });

  it('emits tool_call chunk when AI calls a tool', async () => {
    streamMock
      .mockReturnValueOnce(
        makeToolUseStream([{ id: 'tc1', name: 'bash', input: { command: 'ls' } }])
      )
      .mockReturnValueOnce(makeTextStream(['done']));

    const registry = new ToolRegistry([new BashTool()]);
    const provider = new ClaudeAgentProvider('key', registry);
    const chunks = await collect(provider.query(opts));

    const toolCallChunks = chunks.filter((c) => c.toolCall);
    expect(toolCallChunks).toHaveLength(1);
    expect(toolCallChunks[0]?.toolCall?.name).toBe('bash');
  });

  it('emits tool_result chunk after tool execution', async () => {
    streamMock
      .mockReturnValueOnce(
        makeToolUseStream([{ id: 'tc1', name: 'bash', input: { command: 'echo hi' } }])
      )
      .mockReturnValueOnce(makeTextStream(['done']));

    const registry = new ToolRegistry([new BashTool()]);
    const provider = new ClaudeAgentProvider('key', registry);
    const chunks = await collect(provider.query(opts));

    const resultChunks = chunks.filter((c) => c.toolResult);
    expect(resultChunks).toHaveLength(1);
    expect(resultChunks[0]?.toolResult?.callId).toEqual(expect.any(String));
    expect(resultChunks[0]?.toolResult?.callId.length).toBeGreaterThan(0);
  });

  it('loops when stop_reason is tool_use and stops at end_turn', async () => {
    streamMock
      .mockReturnValueOnce(
        makeToolUseStream([{ id: 'tc1', name: 'bash', input: { command: 'ls' } }])
      )
      .mockReturnValueOnce(makeTextStream(['final answer']));

    const registry = new ToolRegistry([new BashTool()]);
    const provider = new ClaudeAgentProvider('key', registry);
    const chunks = await collect(provider.query(opts));

    expect(streamMock).toHaveBeenCalledTimes(2);
    const textOut = chunks
      .filter((c) => c.delta && !c.done)
      .map((c) => c.delta)
      .join('');
    expect(textOut).toContain('final answer');
    expect(chunks.at(-1)?.done).toBe(true);
  });

  it('stops after max_turns to prevent infinite loop', async () => {
    streamMock.mockImplementation(() =>
      makeToolUseStream([{ id: 'tc1', name: 'bash', input: { command: 'ls' } }])
    );

    const registry = new ToolRegistry([new BashTool()]);
    const provider = new ClaudeAgentProvider('key', registry, undefined, { maxTurns: 2 });
    const chunks = await collect(provider.query(opts));

    expect(streamMock).toHaveBeenCalledTimes(2);
    expect(chunks.at(-1)?.done).toBe(true);
    streamMock.mockReset();
  });

  it('unknown tool returns error result chunk', async () => {
    streamMock
      .mockReturnValueOnce(makeToolUseStream([{ id: 'tc1', name: 'nonexistent', input: {} }]))
      .mockReturnValueOnce(makeTextStream(['ok']));

    const registry = new ToolRegistry([]);
    const provider = new ClaudeAgentProvider('key', registry);
    const chunks = await collect(provider.query(opts));

    const errChunks = chunks.filter((c) => c.toolResult?.isError);
    expect(errChunks).toHaveLength(1);
    expect(errChunks[0]?.toolResult?.output).toMatch(/not found|unknown/i);
  });

  it('passes workDir to tool executor context', async () => {
    streamMock
      .mockReturnValueOnce(makeToolUseStream([{ id: 'tc1', name: 'spy', input: {} }]))
      .mockReturnValueOnce(makeTextStream(['done']));

    const capturedCtx: ToolExecutionContext[] = [];
    const spyTool: ToolExecutor = {
      name: 'spy',
      description: 'captures execution context',
      inputSchema: { type: 'object', properties: {} },
      async execute(_input, ctx) {
        capturedCtx.push(ctx);
        return ToolResult.ok('spy-1', 'ok');
      },
    };

    const registry = new ToolRegistry([spyTool]);
    const provider = new ClaudeAgentProvider('key', registry, undefined, {
      maxTurns: 80,
      workDir: '/my/workspace',
    });
    await collect(provider.query(opts));

    expect(capturedCtx[0]?.workDir).toBe('/my/workspace');
  });

  function makeSpyTool(name: string, seen: string[]) {
    const spy: ToolExecutor = {
      name,
      description: 'spy',
      inputSchema: { type: 'object', properties: {} },
      async execute(_input, _ctx) {
        seen.push(name);
        return ToolResult.ok('spy', 'ok');
      },
    };
    return spy;
  }

  // --- T17: permission flow ---

  it('denies blacklisted tool and emits error result (no execution)', async () => {
    streamMock
      .mockReturnValueOnce(makeToolUseStream([{ id: 'tc1', name: 'Write', input: {} }]))
      .mockReturnValueOnce(makeTextStream(['done']));

    const seen: string[] = [];
    const registry = new ToolRegistry([makeSpyTool('Write', seen)]);
    const resolver = new PermissionResolver();
    const provider = new ClaudeAgentProvider('key', registry, resolver, {
      agent: { allowedTools: [], blockedTools: ['Write'] },
    });
    const chunks = await collect(provider.query(opts));

    const err = chunks.find((c) => c.toolResult?.isError);
    expect(err?.toolResult?.output).toMatch(/blacklisted/i);
    expect(seen).toHaveLength(0);
  });

  it('asks permission for destructive tool and executes when approved', async () => {
    streamMock
      .mockReturnValueOnce(makeToolUseStream([{ id: 'tc1', name: 'Write', input: {} }]))
      .mockReturnValueOnce(makeTextStream(['done']));

    const seen: string[] = [];
    const registry = new ToolRegistry([makeSpyTool('Write', seen)]);
    const resolver = new PermissionResolver();
    const requestPermission = vi.fn().mockResolvedValue(true);
    const provider = new ClaudeAgentProvider('key', registry, resolver, {
      agent: { allowedTools: ['Write'] },
      requestPermission,
    });
    const chunks = await collect(provider.query(opts));

    const permChunks = chunks.filter((c) => c.toolPermission);
    expect(permChunks).toHaveLength(1);
    expect(permChunks[0]?.toolPermission?.name).toBe('Write');
    expect(requestPermission).toHaveBeenCalledTimes(1);
    expect(seen).toHaveLength(1);
  });

  it('asks permission for destructive tool and denies when rejected', async () => {
    streamMock
      .mockReturnValueOnce(makeToolUseStream([{ id: 'tc1', name: 'Write', input: {} }]))
      .mockReturnValueOnce(makeTextStream(['done']));

    const seen: string[] = [];
    const registry = new ToolRegistry([makeSpyTool('Write', seen)]);
    const resolver = new PermissionResolver();
    const requestPermission = vi.fn().mockResolvedValue(false);
    const provider = new ClaudeAgentProvider('key', registry, resolver, {
      agent: { allowedTools: ['Write'] },
      requestPermission,
    });
    const chunks = await collect(provider.query(opts));

    const err = chunks.find((c) => c.toolResult?.isError);
    expect(err?.toolResult?.output).toMatch(/denied|not approved/i);
    expect(seen).toHaveLength(0);
  });

  it('denies destructive tool when no requestPermission handler is wired (safe default)', async () => {
    streamMock
      .mockReturnValueOnce(makeToolUseStream([{ id: 'tc1', name: 'Write', input: {} }]))
      .mockReturnValueOnce(makeTextStream(['done']));

    const seen: string[] = [];
    const registry = new ToolRegistry([makeSpyTool('Write', seen)]);
    const resolver = new PermissionResolver();
    const provider = new ClaudeAgentProvider('key', registry, resolver, {
      agent: { allowedTools: ['Write'] },
    });
    const chunks = await collect(provider.query(opts));

    expect(chunks.some((c) => c.toolPermission)).toBe(true);
    const err = chunks.find((c) => c.toolResult?.isError);
    expect(err?.toolResult?.output).toMatch(/denied|not approved/i);
    expect(seen).toHaveLength(0);
  });

  it('emits a done chunk when the stream aborts mid-turn (abort robustness)', async () => {
    streamMock.mockReturnValue(makeAbortingStream(['partial']));
    const provider = new ClaudeAgentProvider('key');
    const chunks = await collect(provider.query(opts));

    expect(chunks.some((c) => c.done)).toBe(true);
    const text = chunks
      .filter((c) => c.delta && !c.done)
      .map((c) => c.delta)
      .join('');
    expect(text).toBe('partial');
  });
});
