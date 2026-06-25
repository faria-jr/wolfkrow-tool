import type { RerankHit, RerankerPort } from '@wolfkrow/domain';

/**
 * Default reranker when no API key is configured — preserves the input order
 * so the use-case can treat rerank as a no-op stage.
 */
export class NoOpReranker implements RerankerPort {
  readonly enabled = false;

  async rerank(_query: string, documents: string[], topN: number): Promise<RerankHit[]> {
    return documents.slice(0, topN).map((_, index) => ({ index, score: 0 }));
  }
}
