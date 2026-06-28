import type { HydePort } from '@wolfkrow/domain';

/**
 * HyDE adapter (P3-6) via the Anthropic messages API. Generates a dense,
 * technical hypothetical answer used as the retrieval embedding. Returns null
 * on any failure so the caller falls back to the direct query embedding.
 *
 * Prompt ported from the LionClaw reference implementation.
 */
export class AnthropicHyde implements HydePort {
  readonly enabled = true;

  constructor(
    private readonly apiKey: string,
    private readonly model = 'claude-haiku-4-5',
    private readonly endpoint = 'https://api.anthropic.com/v1/messages'
  ) {}

  async generate(query: string): Promise<string | null> {
    try {
      const res = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: 512,
          messages: [{ role: 'user', content: hydePrompt(query) }],
        }),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as {
        content?: Array<{ type: string; text?: string }>;
      };
      const text = data.content?.find((c) => c.type === 'text')?.text;
      return text?.trim() ?? null;
    } catch {
      return null;
    }
  }
}

function hydePrompt(query: string): string {
  return (
    `Escreva um parágrafo denso e técnico que seria a resposta perfeita para: "${query}".\n\n` +
    'Use terminologia específica do domínio. Não responda diretamente — simule o conteúdo ' +
    'de um documento real que conteria essa informação. Máximo 200 palavras.'
  );
}
