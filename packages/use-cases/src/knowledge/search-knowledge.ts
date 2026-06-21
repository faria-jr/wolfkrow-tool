import type { EmbeddingPort, KnowledgeChunk, KnowledgeChunkRepo } from '@wolfkrow/domain';

import type { UseCase } from '../use-case';

export interface SearchKnowledgeInput {
  userId: string;
  query: string;
  limit?: number;
  documentIds?: string[];
  vectorWeight?: number;
  keywordWeight?: number;
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

export class SearchKnowledgeUseCase implements UseCase<SearchKnowledgeInput, SearchKnowledgeOutput> {
  constructor(
    private readonly chunkRepo: KnowledgeChunkRepo,
    private readonly embedder: EmbeddingPort,
  ) {}

  async execute(input: SearchKnowledgeInput): Promise<SearchKnowledgeOutput> {
    const query = input.query.trim();
    if (!query) return { results: [], query };

    const limit = input.limit ?? 10;
    const vectorWeight = input.vectorWeight ?? 0.7;
    const keywordWeight = input.keywordWeight ?? 0.3;
    const fetchLimit = limit * 2;

    const [queryEmbedding, keywordResults] = await Promise.all([
      this.embedder.embed(query),
      this.chunkRepo.keywordSearch(query, fetchLimit, input.documentIds),
    ]);

    const vectorResults = await this.chunkRepo.vectorSearch(
      queryEmbedding,
      fetchLimit,
      input.documentIds,
    );

    const scores = new Map<string, number>();
    const chunkMap = new Map<string, KnowledgeChunk>();

    vectorResults.forEach((r, i) => {
      const s = (1 / (i + 1)) * vectorWeight;
      scores.set(r.chunk.id, (scores.get(r.chunk.id) ?? 0) + s);
      chunkMap.set(r.chunk.id, r.chunk);
    });

    keywordResults.forEach((r, i) => {
      const s = (1 / (i + 1)) * keywordWeight;
      scores.set(r.chunk.id, (scores.get(r.chunk.id) ?? 0) + s);
      chunkMap.set(r.chunk.id, r.chunk);
    });

    const results = [...scores.entries()]
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit)
      .map(([id, score]) => {
        const chunk = chunkMap.get(id)!;
        return { chunk, score, documentId: chunk.documentId };
      });

    return { results, query };
  }
}
