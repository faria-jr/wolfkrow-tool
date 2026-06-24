/**
 * ClaudeCompatProvider — Anthropic SDK apontando para endpoints compatíveis.
 *
 * Suporta presets: zai (GLM), minimax (TokenPlan), moonshot (Kimi), qwen
 * (DashScope). Streaming via messages.stream(). Quando supportsTools=true e
 * toolRegistry é fornecido, executa tool-use loop (idêntico ao ClaudeAgentProvider).
 */

import Anthropic from '@anthropic-ai/sdk';
import { ToolResult, getClaudeCompatPreset } from '@wolfkrow/domain';

import type { ToolRegistry } from '../tools/tool-registry';

import { accumulate, estimateTokens } from './helpers';
import type {
  AIProvider,
  ChatMessage,
  CompletionOptions,
  CompletionResult,
  ImagePart,
  StreamChunk,
} from './types';

type ToolUseBlock = { id: string; name: string; partialJson: string };

interface TurnResult {
  inputTokens: number;
  outputTokens: number;
  toolUseBlocks: Map<string, ToolUseBlock>;
  assistantContent: Anthropic.Messages.ContentBlock[];
  done: boolean;
}

export class ClaudeCompatProvider implements AIProvider {
  private readonly client: Anthropic;
  private readonly toolRegistry: ToolRegistry | undefined;

  constructor(
    apiKey: string,
    source: string | { baseUrl: string },
    _supportsTools?: boolean,
    toolRegistry?: ToolRegistry,
  ) {
    const baseUrl = typeof source === 'string'
      ? (source.startsWith('http') ? source : getClaudeCompatPreset(source).baseUrl)
      : source.baseUrl;
    this.client = new Anthropic({ apiKey, baseURL: baseUrl });
    this.toolRegistry = toolRegistry;
  }

  async *query(options: CompletionOptions): AsyncIterable<StreamChunk> {
    if (!this.toolRegistry) {
      const stream = this.buildStream(options, []);
      yield* drainTextStream(stream);
      return;
    }

    const toolDefs = this.buildToolDefs();
    const nonSystem = options.messages.filter((m) => m.role !== 'system');
    const systemFromMessages = options.messages
      .filter((m) => m.role === 'system')
      .map((m) => m.content)
      .join('\n');
    const effectiveSystem = options.system ?? (systemFromMessages || undefined);

    const messages: Anthropic.Messages.MessageParam[] = nonSystem.map(toAnthropicMessage);
    let totalInput = 0;
    let totalOutput = 0;

    for (let turn = 0; turn < 80; turn++) {
      const result = yield* this.streamOneTurn(messages, options, effectiveSystem, toolDefs);
      totalInput += result.inputTokens;
      totalOutput += result.outputTokens;

      if (result.done) {
        yield { delta: '', done: true, inputTokens: totalInput, outputTokens: totalOutput };
        return;
      }

      const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];
      for (const block of result.toolUseBlocks.values()) {
        const input = parseJson(block.partialJson);
        yield { delta: '', toolCall: { id: block.id, name: block.name, input } };
        const toolResult = await this.executeTool(block, input);
        yield { delta: '', toolResult: { callId: toolResult.callId, output: toolResult.output, isError: toolResult.isError } };
        toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: toolResult.output, is_error: toolResult.isError });
      }

      messages.push({ role: 'assistant', content: result.assistantContent });
      messages.push({ role: 'user', content: toolResults });
    }

    yield { delta: '', done: true, inputTokens: totalInput, outputTokens: totalOutput };
  }

  private buildStream(
    options: CompletionOptions,
    toolDefs: Anthropic.Messages.Tool[],
  ): ReturnType<Anthropic['messages']['stream']> {
    const nonSystem = options.messages.filter((m) => m.role !== 'system');
    const systemFromMessages = options.messages
      .filter((m) => m.role === 'system')
      .map((m) => m.content)
      .join('\n');
    const effectiveSystem = options.system ?? (systemFromMessages || undefined);

    const messages = nonSystem.map(toAnthropicMessage);
    if (options.imageParts?.length) {
      injectImageParts(messages, options.imageParts);
    }

    return this.client.messages.stream(
      {
        model: options.model,
        max_tokens: options.maxTokens ?? 4096,
        temperature: options.temperature ?? 0.5,
        ...(effectiveSystem ? { system: effectiveSystem } : {}),
        messages,
        ...(toolDefs.length > 0 ? { tools: toolDefs } : {}),
      },
      { signal: options.signal },
    );
  }

  private buildToolDefs(): Anthropic.Messages.Tool[] {
    if (!this.toolRegistry) return [];
    return this.toolRegistry.toDefinitions([]).map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.input_schema as Anthropic.Messages.Tool['input_schema'],
    }));
  }

  private async executeTool(block: ToolUseBlock, input: Record<string, unknown>): Promise<ToolResult> {
    const executor = this.toolRegistry?.get(block.name);
    if (!executor) return ToolResult.error(block.id, `Tool "${block.name}" not found`);
    try {
      return await executor.execute(input, { userId: 'agent' });
    } catch (err) {
      return ToolResult.error(block.id, err instanceof Error ? err.message : String(err));
    }
  }

  private async *streamOneTurn(
    messages: Anthropic.Messages.MessageParam[],
    options: CompletionOptions,
    system: string | undefined,
    toolDefs: Anthropic.Messages.Tool[],
  ): AsyncGenerator<StreamChunk, TurnResult> {
    const stream = this.client.messages.stream(
      {
        model: options.model,
        max_tokens: options.maxTokens ?? 4096,
        temperature: options.temperature ?? 0.5,
        ...(system ? { system } : {}),
        messages,
        ...(toolDefs.length > 0 ? { tools: toolDefs } : {}),
      },
      { signal: options.signal },
    );

    const toolUseBlocks = new Map<string, ToolUseBlock>();
    let currentToolId: string | null = null;

    for await (const event of stream) {
      if (event.type === 'content_block_start') {
        const block = (event as { content_block: Anthropic.Messages.ContentBlock }).content_block;
        if (block.type === 'tool_use') {
          currentToolId = block.id;
          toolUseBlocks.set(block.id, { id: block.id, name: block.name, partialJson: '' });
        }
      } else if (event.type === 'content_block_delta') {
        const delta = (event as { delta: Anthropic.Messages.RawContentBlockDelta }).delta;
        if (delta.type === 'text_delta') {
          yield { delta: delta.text };
        } else if (delta.type === 'input_json_delta' && currentToolId) {
          const blk = toolUseBlocks.get(currentToolId);
          if (blk) blk.partialJson += delta.partial_json;
        }
      } else if (event.type === 'content_block_stop') {
        currentToolId = null;
      }
    }

    const final = await stream.finalMessage();
    return {
      inputTokens: final.usage.input_tokens,
      outputTokens: final.usage.output_tokens,
      toolUseBlocks,
      assistantContent: final.content,
      done: final.stop_reason !== 'tool_use' || toolUseBlocks.size === 0,
    };
  }

  async complete(options: CompletionOptions): Promise<CompletionResult> {
    return accumulate(this.query(options));
  }

  async countTokens(messages: ChatMessage[], _model: string): Promise<number> {
    return estimateTokens(messages.map((m) => m.content).join(''));
  }
}

async function* drainTextStream(
  stream: ReturnType<Anthropic['messages']['stream']>,
): AsyncIterable<StreamChunk> {
  try {
    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        yield { delta: event.delta.text };
      }
    }
    const final = await stream.finalMessage();
    yield {
      delta: '',
      done: true,
      inputTokens: final.usage.input_tokens,
      outputTokens: final.usage.output_tokens,
    };
  } catch (err) {
    yield { delta: '', done: true };
    throw err;
  }
}

function parseJson(partial: string): Record<string, unknown> {
  if (!partial) return {};
  try { return JSON.parse(partial) as Record<string, unknown>; } catch { return {}; }
}

function toAnthropicMessage(message: ChatMessage): Anthropic.Messages.MessageParam {
  return {
    role: message.role === 'assistant' ? 'assistant' : 'user',
    content: message.content,
  };
}

function injectImageParts(
  messages: Anthropic.Messages.MessageParam[],
  parts: ImagePart[],
): void {
  const lastUserIdx = messages.reduce(
    (found, m, i) => (m.role === 'user' ? i : found),
    -1,
  );
  if (lastUserIdx < 0) return;

  const lastMsg = messages[lastUserIdx];
  if (!lastMsg) return;
  const text = typeof lastMsg.content === 'string' ? (lastMsg.content as string) : '';

  const imageBlocks: Anthropic.Messages.ImageBlockParam[] = parts.map((p) => ({
    type: 'image',
    source: {
      type: 'base64',
      media_type: p.mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
      data: p.data,
    },
  }));

  messages[lastUserIdx] = {
    role: 'user',
    content: [...imageBlocks, { type: 'text', text }],
  };
}
