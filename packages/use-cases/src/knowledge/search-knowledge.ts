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
    const fetchLimit = limit * 3; // candidate pool for rerank

    const embedding = await this.embedder.embed(query);

    // HyDE: optionally swap the vector-embedding for a hypothetical answer's.
    let effectiveEmbedding = embedding;
    if (this.hyde?.enabled) {
      const hypothetical = await this.hyde.generate(query);
      if (hypothetical) effectiveEmbedding = await this.embedder.embed(hypothetical);
    }

    const fused = await this.chunkRepo.hybridSearch(query, effectiveEmbedding, fetchLimit, input.documentIds);

    // Reranker: optionally reorder the candidate pool by cross-encoder score.
    if (this.reranker?.enabled && fused.length > 0) {
      const documents = fused.map((f) => f.chunk.content);
      const hits = await this.reranker.rerank(query, documents, limit);
      const results: SearchResult[] = [];
      for (const { index, score } of hits) {
        const chunk = fused[index]?.chunk;
        if (chunk) results.push({ chunk, score, documentId: chunk.documentId });
      }
      if (results.length > 0) return { results, query };
    }

    const results = fused.slice(0, limit).map((h) => ({
      chunk: h.chunk,
      score: h.score,
      documentId: h.chunk.documentId,
    }));
    return { results, query };
  }
}
