/**
 * ClaudeAgentProvider — Anthropic Claude in agentic mode.
 * Implements a real tool_use → tool_result loop until stop_reason = end_turn.
 * Tools are resolved via ToolRegistry; permission checking is caller's responsibility.
 */

import Anthropic from '@anthropic-ai/sdk';
import { ToolResult } from '@wolfkrow/domain';
import type { PermissionResolver } from '@wolfkrow/domain';

import type { ToolRegistry } from '../tools/tool-registry';

import { accumulate, estimateTokens } from './helpers';
import type {
  AIProvider,
  ChatMessage,
  CompletionOptions,
  CompletionResult,
  StreamChunk,
} from './types';

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: Anthropic.Tool['input_schema'];
}

const AGENT_SYSTEM_SUFFIX =
  '\n\nYou are running in agentic mode. Use your tools when needed. ' +
  'Reason step-by-step before acting. Be concise and accurate.';

const DEFAULT_MAX_TURNS = 80;

type ToolUseBlock = { id: string; name: string; partialJson: string };

interface TurnResult {
  inputTokens: number;
  outputTokens: number;
  toolUseBlocks: Map<string, ToolUseBlock>;
  assistantContent: Anthropic.Messages.ContentBlock[];
  done: boolean;
}

export interface ClaudeAgentOptions {
  maxTurns?: number;
  workDir?: string;
}

export class ClaudeAgentProvider implements AIProvider {
  private readonly client: Anthropic;
  private readonly registry: ToolRegistry | undefined;
  // permissionResolver is reserved for T17 (tool permission UI flow)
  private readonly maxTurns: number;
  private readonly workDir: string | undefined;

  constructor(
    apiKey: string,
    registry?: ToolRegistry,
    permissionResolver?: PermissionResolver,
    opts: ClaudeAgentOptions = {},
  ) {
    this.client = new Anthropic({ apiKey });
    this.registry = registry;
    void permissionResolver;
    this.maxTurns = opts.maxTurns ?? DEFAULT_MAX_TURNS;
    this.workDir = opts.workDir;
  }

  async *query(options: CompletionOptions): AsyncIterable<StreamChunk> {
    const callOptions = { ...options, system: (options.system ?? '') + AGENT_SYSTEM_SUFFIX };
    const messages: Anthropic.Messages.MessageParam[] = options.messages.map(toAnthropicMessage);
    const toolDefs = this.buildToolDefs();
    let totalInput = 0;
    let totalOutput = 0;

    for (let turn = 0; turn < this.maxTurns; turn++) {
      const result: TurnResult = yield* this.streamOneTurn(messages, callOptions, toolDefs);
      totalInput += result.inputTokens;
      totalOutput += result.outputTokens;

      if (result.done) {
        yield { delta: '', done: true, inputTokens: totalInput, outputTokens: totalOutput };
        return;
      }

      const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];
      for (const block of result.toolUseBlocks.values()) {
        const input = this.parseToolInput(block.partialJson);
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

  private buildToolDefs(): Anthropic.Messages.Tool[] {
    if (!this.registry) return [];
    return this.registry.toDefinitions([]).map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.input_schema as Anthropic.Messages.Tool['input_schema'],
    }));
  }

  private parseToolInput(partialJson: string): Record<string, unknown> {
    if (!partialJson) return {};
    try {
      return JSON.parse(partialJson) as Record<string, unknown>;
    } catch {
      return {};
    }
  }

  private async executeTool(block: ToolUseBlock, input: Record<string, unknown>): Promise<ToolResult> {
    const executor = this.registry?.get(block.name);
    if (!executor) return ToolResult.error(block.id, `Tool "${block.name}" not found in registry`);
    try {
      return await executor.execute(input, { userId: 'agent', ...(this.workDir !== undefined ? { workDir: this.workDir } : {}) });
    } catch (err) {
      return ToolResult.error(block.id, err instanceof Error ? err.message : String(err));
    }
  }

  private buildParams(
    options: CompletionOptions,
    messages: Anthropic.Messages.MessageParam[],
    toolDefs: Anthropic.Messages.Tool[],
  ): Anthropic.Messages.MessageCreateParamsStreaming {
    return {
      model: options.model,
      max_tokens: options.maxTokens ?? 8096,
      temperature: options.temperature ?? 0.3,
      system: options.system ?? '',
      messages,
      stream: true,
      ...(toolDefs.length > 0 ? { tools: toolDefs } : {}),
    };
  }

  private handleDelta(
    delta: Anthropic.Messages.RawContentBlockDelta,
    currentToolId: string | null,
    toolUseBlocks: Map<string, ToolUseBlock>,
  ): string | null {
    if (delta.type === 'text_delta') return delta.text;
    if (delta.type === 'input_json_delta' && currentToolId) {
      const block = toolUseBlocks.get(currentToolId);
      if (block) block.partialJson += delta.partial_json;
    }
    return null;
  }

  private async *streamOneTurn(
    messages: Anthropic.Messages.MessageParam[],
    options: CompletionOptions,
    toolDefs: Anthropic.Messages.Tool[],
  ): AsyncGenerator<StreamChunk, TurnResult> {
    const params = this.buildParams(options, messages, toolDefs);
    const stream = this.client.messages.stream(params, { signal: options.signal });
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
        const text = this.handleDelta(delta, currentToolId, toolUseBlocks);
        if (text !== null) yield { delta: text };
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

function toAnthropicMessage(m: ChatMessage): Anthropic.Messages.MessageParam {
  return { role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content };
}
