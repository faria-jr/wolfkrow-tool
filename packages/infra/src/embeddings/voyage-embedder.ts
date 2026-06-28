import type { EmbeddingPort } from '@wolfkrow/domain';

const VOYAGE_API_URL = 'https://api.voyageai.com/v1/embeddings';

export class VoyageEmbedder implements EmbeddingPort {
  readonly dimensions = 1024;

  constructor(
    private readonly apiKey: string,
    private readonly model: string = 'voyage-3'
  ) {}

  async embed(text: string): Promise<number[]> {
    const result = await this.embedBatch([text]);
    return result[0]!;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];

    const res = await fetch(VOYAGE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({ input: texts, model: this.model }),
    });

    if (!res.ok) {
      throw new Error(`Voyage API error ${res.status}: ${await res.text()}`);
    }

    const data = (await res.json()) as { data: Array<{ embedding: number[] }> };
    return data.data.map((d) => d.embedding);
  }
}
