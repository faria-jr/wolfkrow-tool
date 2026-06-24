/**
 * Base para providers que usam OpenAI SDK (CodexProvider, ClaudeCompatProvider, Ollama).
 * Streaming via chat.completions.create com stream_options.include_usage.
 */

import type OpenAI from 'openai';

import { accumulate, estimateTokens } from './helpers';
import type {
  AIProvider,
  ChatMessage,
  CompletionOptions,
  CompletionResult,
  StreamChunk,
} from './types';

type OAIChunk = { choices: Array<{ delta?: { content?: string | null } }>; usage: { prompt_tokens: number; completion_tokens: number } | null };

function toOpenAIMessages(options: CompletionOptions): OpenAI.Chat.ChatCompletionMessageParam[] {
  const msgs: OpenAI.Chat.ChatCompletionMessageParam[] = [];
  if (options.system) msgs.push({ role: 'system', content: options.system });
  for (const m of options.messages) {
    msgs.push({ role: m.role as 'user' | 'assistant' | 'system', content: m.content });
  }
  return msgs;
}

function toStreamChunks(chunk: OAIChunk): StreamChunk[] {
  const results: StreamChunk[] = [];
  const delta = chunk.choices[0]?.delta?.content ?? '';
  if (delta) results.push({ delta });
  if (chunk.usage) {
    results.push({ delta: '', done: true, inputTokens: chunk.usage.prompt_tokens, outputTokens: chunk.usage.completion_tokens });
  }
  return results;
}

export abstract class OpenAIBaseProvider implements AIProvider {
  constructor(protected readonly client: OpenAI) {}

  /**
   * Hook for subclasses to enforce SSRF DNS-rebind revalidation before the
   * first request. Default is a no-op; providers with a custom baseURL override.
   */
  protected async ensureSsrfSafe(): Promise<void> {}

  async *query(options: CompletionOptions): AsyncIterable<StreamChunk> {
    await this.ensureSsrfSafe();
    const stream = await this.client.chat.completions.create(
      {
        model: options.model,
        messages: toOpenAIMessages(options),
        max_tokens: options.maxTokens ?? 4096,
        temperature: options.temperature ?? 0.5,
        stream: true,
        stream_options: { include_usage: true },
      },
      { signal: options.signal },
    ) as AsyncIterable<OAIChunk>;

    let usageEmitted = false;
    for await (const chunk of stream) {
      for (const sc of toStreamChunks(chunk)) {
        if (sc.done) usageEmitted = true;
        yield sc;
      }
    }
    if (!usageEmitted) yield { delta: '', done: true };
  }

  async complete(options: CompletionOptions): Promise<CompletionResult> {
    return accumulate(this.query(options));
  }

  async countTokens(messages: ChatMessage[], _model: string): Promise<number> {
    return estimateTokens(messages.map((m) => m.content).join(''));
  }
}
