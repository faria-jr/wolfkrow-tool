/**
 * ClaudeAgentProvider — Anthropic Claude em modo agentic.
 * Estende AnthropicProvider adicionando suporte a tool use e
 * loop de agente (tool_result → nova chamada até stop_reason=end_turn).
 */

import Anthropic from '@anthropic-ai/sdk';

import { accumulate, estimateTokens } from './helpers';
import type {
  AIProvider,
  ChatMessage,
  CompletionOptions,
  CompletionResult,
  StreamChunk,
} from './types';

const AGENT_SYSTEM_SUFFIX =
  '\n\nYou are running in agentic mode. Use your tools when needed. ' +
  'Reason step-by-step before acting. Be concise and accurate.';

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: Anthropic.Tool['input_schema'];
}

export class ClaudeAgentProvider implements AIProvider {
  private readonly client: Anthropic;
  private readonly tools: ToolDefinition[];

  constructor(apiKey: string, tools: ToolDefinition[] = []) {
    this.client = new Anthropic({ apiKey });
    this.tools = tools;
  }

  async *query(options: CompletionOptions): AsyncIterable<StreamChunk> {
    const system = (options.system ?? '') + AGENT_SYSTEM_SUFFIX;
    const messages = options.messages.map(toAnthropicMessage);

    const requestParams: Anthropic.Messages.MessageCreateParamsStreaming = {
      model: options.model,
      max_tokens: options.maxTokens ?? 8096,
      temperature: options.temperature ?? 0.3,
      system,
      messages,
      stream: true,
      ...(this.tools.length > 0 ? { tools: this.tools } : {}),
    };

    const stream = this.client.messages.stream(requestParams, { signal: options.signal });

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
