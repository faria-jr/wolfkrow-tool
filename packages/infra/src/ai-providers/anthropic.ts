/**
 * Anthropic provider — streaming via messages.stream().
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

export class AnthropicProvider implements AIProvider {
  private readonly client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async *query(options: CompletionOptions): AsyncIterable<StreamChunk> {
    const stream = this.client.messages.stream(
      {
        model: options.model,
        max_tokens: options.maxTokens ?? 4096,
        temperature: options.temperature ?? 0.5,
        ...(options.system ? { system: options.system } : {}),
        messages: options.messages.map(toAnthropicMessage),
      },
      { signal: options.signal },
    );

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

function toAnthropicMessage(message: ChatMessage): Anthropic.Messages.MessageParam {
  return {
    role: message.role === 'assistant' ? 'assistant' : 'user',
    content: message.content,
  };
}
