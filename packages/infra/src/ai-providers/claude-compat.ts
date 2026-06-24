/**
 * ClaudeCompatProvider — Anthropic SDK apontando para endpoints compatíveis.
 *
 * Suporta presets: zai (GLM), minimax (TokenPlan), moonshot (Kimi), qwen
 * (DashScope). Streaming via messages.stream(); tool calls são degradados
 * graciosamente (ignorados, como no AnthropicProvider base).
 */

import Anthropic from '@anthropic-ai/sdk';
import { getClaudeCompatPreset } from '@wolfkrow/domain';

import { accumulate, estimateTokens } from './helpers';
import type {
  AIProvider,
  ChatMessage,
  CompletionOptions,
  CompletionResult,
  ImagePart,
  StreamChunk,
} from './types';

export class ClaudeCompatProvider implements AIProvider {
  private readonly client: Anthropic;

  constructor(apiKey: string, source: string | { baseUrl: string }) {
    const baseUrl = typeof source === 'string'
      ? getClaudeCompatPreset(source).baseUrl
      : source.baseUrl;
    this.client = new Anthropic({ apiKey, baseURL: baseUrl });
  }

  async *query(options: CompletionOptions): AsyncIterable<StreamChunk> {
    // Extract system messages from the messages array; Anthropic API requires
    // them as the top-level `system` param, not as message turns.
    const nonSystemMessages = options.messages.filter((m) => m.role !== 'system');
    const systemFromMessages = options.messages
      .filter((m) => m.role === 'system')
      .map((m) => m.content)
      .join('\n');
    const effectiveSystem = options.system ?? (systemFromMessages || undefined);

    const messages = nonSystemMessages.map(toAnthropicMessage);
    if (options.imageParts?.length) {
      injectImageParts(messages, options.imageParts);
    }

    const stream = this.client.messages.stream(
      {
        model: options.model,
        max_tokens: options.maxTokens ?? 4096,
        temperature: options.temperature ?? 0.5,
        ...(effectiveSystem ? { system: effectiveSystem } : {}),
        messages,
      },
      { signal: options.signal },
    );

    yield* drainStream(stream);
  }

  async complete(options: CompletionOptions): Promise<CompletionResult> {
    return accumulate(this.query(options));
  }

  async countTokens(messages: ChatMessage[], _model: string): Promise<number> {
    return estimateTokens(messages.map((m) => m.content).join(''));
  }
}

async function* drainStream(
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
    // Always emit the done sentinel so callers don't hang waiting for it.
    yield { delta: '', done: true };
    throw err;
  }
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
