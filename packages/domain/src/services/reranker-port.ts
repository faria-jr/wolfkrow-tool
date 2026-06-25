/**
 * Reranker port (P3-6). Optional second-stage reranking over hybrid-search
 * candidates (e.g. Cohere rerank-multilingual). Adapters are feature-flagged
 * (enabled only when an API key is configured); `NoOpReranker` is the default.
 */
export interface RerankHit {
  /** Index into the input `documents` array. */
  index: number;
  /** Relevance score in the adapter's native scale (e.g. [0,1]). */
  score: number;
}

export interface RerankerPort {
  readonly enabled: boolean;
  rerank(query: string, documents: string[], topN: number): Promise<RerankHit[]>;
}
