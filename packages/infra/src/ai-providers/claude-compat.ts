/**
 * ClaudeCompatProvider — Anthropic SDK apontando para endpoints compatíveis.
 *
 * Suporta presets: zai (GLM), minimax (TokenPlan), moonshot (Kimi), qwen
 * (DashScope). Streaming via messages.stream(). Quando supportsTools=true e
 * toolRegistry é fornecido, executa tool-use loop (idêntico ao ClaudeAgentProvider).
 */

import Anthropic from '@anthropic-ai/sdk';
import { ToolResult, getClaudeCompatPreset } from '@wolfkrow/domain';
import type { AgentPermissions, PermissionResolver } from '@wolfkrow/domain';

import type { ToolRegistry } from '../tools/tool-registry';

import type { ToolUseBlock } from './claude-compat-helpers';
import {
  drainTextStream,
  injectImageParts,
  parseJson,
  processStreamEvents,
  toMessageParams,
} from './claude-compat-helpers';
import { accumulate, estimateTokens } from './helpers';
import { executeWithPermissionGate } from './permission-gate';
import { assertPublicProviderHost } from './ssrf-guard';
import type {
  AIProvider,
  ChatMessage,
  CompletionOptions,
  CompletionResult,
  StreamChunk,
  ToolPermissionEvent,
} from './types';

interface TurnResult {
  inputTokens: number;
  outputTokens: number;
  toolUseBlocks: Map<string, ToolUseBlock>;
  assistantContent: Anthropic.Messages.ContentBlock[];
  done: boolean;
}

export interface ClaudeCompatOptions {
  supportsTools?: boolean;
  toolRegistry?: ToolRegistry;
  permissionResolver?: PermissionResolver;
  agent?: AgentPermissions;
  requestPermission?: (req: ToolPermissionEvent) => Promise<boolean>;
  workDir?: string;
}

export class ClaudeCompatProvider implements AIProvider {
  private readonly client: Anthropic;
  private readonly toolRegistry: ToolRegistry | undefined;
  private readonly permissionResolver: PermissionResolver | undefined;
  private readonly agent: AgentPermissions | undefined;
  private readonly requestPermission: ((req: ToolPermissionEvent) => Promise<boolean>) | undefined;
  private readonly workDir: string | undefined;
  private readonly resolvedBaseUrl: string | undefined;
  private ssrfPromise: Promise<void> | undefined;

  constructor(
    apiKey: string,
    source: string | { baseUrl: string },
    opts: ClaudeCompatOptions = {},
  ) {
    const baseUrl = typeof source === 'string'
      ? (source.startsWith('http') ? source : getClaudeCompatPreset(source).baseUrl)
      : source.baseUrl;
    this.client = new Anthropic({ apiKey, baseURL: baseUrl });
    this.resolvedBaseUrl = baseUrl;
    this.toolRegistry = opts.toolRegistry;
    this.permissionResolver = opts.permissionResolver;
    this.agent = opts.agent;
    this.requestPermission = opts.requestPermission;
    this.workDir = opts.workDir;
  }

  private async ensureSsrfSafe(): Promise<void> {
    if (!this.resolvedBaseUrl) return;
    if (!this.ssrfPromise) {
      this.ssrfPromise = assertPublicProviderHost(this.resolvedBaseUrl);
    }
    return this.ssrfPromise;
  }

  async *query(options: CompletionOptions): AsyncIterable<StreamChunk> {
    await this.ensureSsrfSafe();
    if (!this.toolRegistry) {
      const stream = this.buildStream(options, []);
      yield* drainTextStream(stream);
      return;
    }

    const toolDefs = this.buildToolDefs();
    const systemFromMessages = options.messages
      .filter((m) => m.role === 'system')
      .map((m) => m.content)
      .join('\n');
    const effectiveSystem = options.system ?? (systemFromMessages || undefined);

    const messages: Anthropic.Messages.MessageParam[] = toMessageParams(options);
    let totalInput = 0;
    let totalOutput = 0;

    for (let turn = 0; turn < 80; turn++) {
      // P1-6: if the request was aborted, stop the tool-use loop early so we
      // don't launch another model turn or start new tools after a Stop.
      if (options.signal?.aborted) {
        yield { delta: '', done: true, inputTokens: totalInput, outputTokens: totalOutput };
        return;
      }
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
        // P1-6: don't start a new tool after the user aborted.
        if (options.signal?.aborted) {
          yield {
            delta: '',
            toolResult: {
              callId: block.id,
              output: 'aborted by user',
              isError: true,
            },
          };
          continue;
        }
        const { result: toolResult, permissionChunk } = await this.executeWithPermission(block, input, options.signal);
        if (permissionChunk) yield permissionChunk;
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
    messages?: Anthropic.Messages.MessageParam[],
    system?: string,
  ): ReturnType<Anthropic['messages']['stream']> {
    const messageParams = messages ?? toMessageParams(options);
    if (!messages && options.imageParts?.length) {
      injectImageParts(messageParams, options.imageParts);
    }

    return this.client.messages.stream(
      {
        model: options.model,
        max_tokens: options.maxTokens ?? 4096,
        temperature: options.temperature ?? 0.5,
        ...(system ? { system } : {}),
        messages: messageParams,
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

  private async executeTool(
    block: ToolUseBlock,
    input: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<ToolResult> {
    const executor = this.toolRegistry?.get(block.name);
    if (!executor) return ToolResult.error(block.id, `Tool "${block.name}" not found`);
    try {
      return await executor.execute(input, {
        userId: 'agent',
        ...(this.workDir !== undefined ? { workDir: this.workDir } : {}),
        ...(signal !== undefined ? { signal } : {}),
      });
    } catch (err) {
      return ToolResult.error(block.id, err instanceof Error ? err.message : String(err));
    }
  }

  /**
   * Gate tool execution behind the PermissionResolver.
   * Delegates to shared permission-gate helper.
   */
  private executeWithPermission(
    block: ToolUseBlock,
    input: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<{ result: ToolResult; permissionChunk?: StreamChunk }> {
    return executeWithPermissionGate(
      {
        ...(this.agent !== undefined ? { agent: this.agent } : {}),
        ...(this.permissionResolver !== undefined ? { permissionResolver: this.permissionResolver } : {}),
        ...(this.requestPermission !== undefined ? { requestPermission: this.requestPermission } : {}),
      },
      { id: block.id, name: block.name },
      input,
      () => this.executeTool(block, input, signal),
    );
  }

  private async *streamOneTurn(
    messages: Anthropic.Messages.MessageParam[],
    options: CompletionOptions,
    system: string | undefined,
    toolDefs: Anthropic.Messages.Tool[],
  ): AsyncGenerator<StreamChunk, TurnResult> {
    const stream = this.buildStream(options, toolDefs, messages, system);
    const { toolUseBlocks, usage, stopReason, assistantContent } = yield* processStreamEvents(stream);
    return {
      inputTokens: usage.input_tokens,
      outputTokens: usage.output_tokens,
      toolUseBlocks,
      assistantContent,
      done: stopReason !== 'tool_use' || toolUseBlocks.size === 0,
    };
  }

  async complete(options: CompletionOptions): Promise<CompletionResult> {
    return accumulate(this.query(options));
  }

  async countTokens(messages: ChatMessage[], _model: string): Promise<number> {
    return estimateTokens(messages.map((m) => m.content).join(''));
  }
}

