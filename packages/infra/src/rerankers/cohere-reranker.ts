import type { RerankHit, RerankerPort } from '@wolfkrow/domain';

/**
 * Cohere rerank adapter (P3-6). Calls the v2 rerank endpoint with
 * `rerank-multilingual-v3.0`. Returns [] on any failure so the caller falls
 * back to the RRF-ordered candidates.
 */
export class CohereReranker implements RerankerPort {
  readonly enabled = true;

  constructor(
    private readonly apiKey: string,
    private readonly model = 'rerank-multilingual-v3.0',
    private readonly endpoint = 'https://api.cohere.ai/v2/rerank',
  ) {}

  async rerank(query: string, documents: string[], topN: number): Promise<RerankHit[]> {
    if (documents.length === 0) return [];
    try {
      const res = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ model: this.model, query, documents, top_n: topN }),
      });
      if (!res.ok) return [];
      const data = (await res.json()) as {
        results?: Array<{ index: number; relevance_score: number }>;
      };
      return (data.results ?? []).map((r) => ({ index: r.index, score: r.relevance_score }));
    } catch {
      return [];
    }
  }
}
