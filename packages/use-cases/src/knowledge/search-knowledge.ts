import type { HydePort, KnowledgeChunk, KnowledgeChunkRepo, RerankerPort, EmbeddingPort } from '@wolfkrow/domain';

import type { UseCase } from '../use-case';

export interface SearchKnowledgeInput {
  userId: string;
  query: string;
  limit?: number;
  documentIds?: string[];
}

export interface SearchResult {
  chunk: KnowledgeChunk;
  score: number;
  documentId: string;
}

export interface SearchKnowledgeOutput {
  results: SearchResult[];
  query: string;
}

/**
 * P3-6 — canonical hybrid search (BM25 via FTS5 + vector via vec0, fused with
 * Reciprocal Rank Fusion k=60) from KnowledgeChunkRepo, with two optional
 * feature-flagged stages:
 *  - HyDE: generate a hypothetical answer, embed it, use it for vector recall
 *    (improves queries with no keyword overlap).
 *  - Reranker: second-stage rerank of the top candidate pool (e.g. Cohere).
 * Both default to disabled (undefined) so callers without keys get plain RRF.
 */
export class SearchKnowledgeUseCase implements UseCase<SearchKnowledgeInput, SearchKnowledgeOutput> {
  constructor(
    private readonly chunkRepo: KnowledgeChunkRepo,
    private readonly embedder: EmbeddingPort,
    private readonly reranker?: RerankerPort,
    private readonly hyde?: HydePort,
  ) {}

  async execute(input: SearchKnowledgeInput): Promise<SearchKnowledgeOutput> {
    const query = input.query.trim();
    if (!query) return { results: [], query };

    const limit = input.limit ?? 10;
    const embedding = await this.embedder.embed(query);
    const effectiveEmbedding = await this.applyHyde(query, embedding);
    const fused = await this.chunkRepo.hybridSearch(query, effectiveEmbedding, limit * 3, input.documentIds);

    const reranked = await this.rerank(query, fused, limit);
    if (reranked) return { results: reranked, query };

    const results = fused.slice(0, limit).map((h) => ({
      chunk: h.chunk,
      score: h.score,
      documentId: h.chunk.documentId,
    }));
    return { results, query };
  }

  /** HyDE: optionally swap the embedding for a hypothetical answer's. */
  private async applyHyde<T>(query: string, embedding: T): Promise<T> {
    if (!this.hyde?.enabled) return embedding;
    const hypothetical = await this.hyde.generate(query);
    return hypothetical ? ((await this.embedder.embed(hypothetical)) as T) : embedding;
  }

  /** Reranker: optionally reorder the candidate pool by cross-encoder score. */
  private async rerank(query: string, fused: ReadonlyArray<{ chunk: KnowledgeChunk }>, limit: number): Promise<SearchResult[] | null> {
    if (!this.reranker?.enabled || fused.length === 0) return null;
    const documents = fused.map((f) => f.chunk.content);
    const hits = await this.reranker.rerank(query, documents, limit);
    const results: SearchResult[] = [];
    for (const { index, score } of hits) {
      const chunk = fused[index]?.chunk;
      if (chunk) results.push({ chunk, score, documentId: chunk.documentId });
    }
    return results.length > 0 ? results : null;
  }
}
