import type { CompletionResult, StreamChunk } from './types';

/** Acumula um stream de chunks em CompletionResult (complete() de qualquer provider). */
export async function accumulate(
  stream: AsyncIterable<StreamChunk>,
): Promise<CompletionResult> {
  let content = '';
  const usage = { inputTokens: 0, outputTokens: 0 };

  for await (const chunk of stream) {
    content += chunk.delta;
    if (chunk.inputTokens !== undefined) usage.inputTokens = chunk.inputTokens;
    if (chunk.outputTokens !== undefined) usage.outputTokens = chunk.outputTokens;
  }

  return { content, usage };
}

/** Heurística de contagem de tokens (~4 chars/token) — fallback quando o provider
 *  não expõe API nativa. Substituída por API real em A.2 por provider. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
