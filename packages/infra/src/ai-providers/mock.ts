import { accumulate, estimateTokens } from './helpers';
import type {
  AIProvider,
  ChatMessage,
  CompletionOptions,
  CompletionResult,
  StreamChunk,
} from './types';

/** Provider de teste — emite chunks configuráveis, nunca chama SDK real. */
export class MockProvider implements AIProvider {
  constructor(private readonly chunks: string[] = ['Hello', ' world']) {}

  async *query(_options: CompletionOptions): AsyncIterable<StreamChunk> {
    for (const chunk of this.chunks) {
      yield { delta: chunk };
    }
    const text = this.chunks.join('');
    yield {
      delta: '',
      done: true,
      inputTokens: estimateTokens(text),
      outputTokens: estimateTokens(text),
    };
  }

  async complete(options: CompletionOptions): Promise<CompletionResult> {
    return accumulate(this.query(options));
  }

  async countTokens(messages: ChatMessage[], _model: string): Promise<number> {
    return estimateTokens(messages.map((m) => m.content).join(''));
  }
}
