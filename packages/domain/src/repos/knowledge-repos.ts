import type { KnowledgeChunk } from '../entities/knowledge-chunk';
import type { KnowledgeDocument } from '../entities/knowledge-document';

export interface KnowledgeDocRepo {
  findById(id: string): Promise<KnowledgeDocument | null>;
  findByUserId(userId: string): Promise<KnowledgeDocument[]>;
  save(doc: KnowledgeDocument): Promise<KnowledgeDocument>;
  delete(id: string): Promise<void>;
}

export interface ChunkSearchResult {
  chunk: KnowledgeChunk;
  distance: number;
}

export interface KeywordSearchResult {
  chunk: KnowledgeChunk;
  rank: number;
}

/**
 * M4 — Hybrid search result combining vector + keyword via Reciprocal Rank
 * Fusion (RRF, k=60). `score` is the RRF sum; `vectorDistance` and
 * `keywordRank` are populated only when the respective search contributed
 * to the fused ranking (both null only if the chunk came from a future
 * strategy that isn't yet wired up).
 */
export interface HybridChunkSearchResult {
  chunk: KnowledgeChunk;
  score: number;
  vectorDistance?: number;
  keywordRank?: number;
}

export interface KnowledgeChunkRepo {
  saveMany(chunks: KnowledgeChunk[]): Promise<KnowledgeChunk[]>;
  findByDocumentId(documentId: string): Promise<KnowledgeChunk[]>;
  deleteByDocumentId(documentId: string): Promise<void>;
  vectorSearch(embedding: number[], limit: number, documentIds?: string[]): Promise<ChunkSearchResult[]>;
  keywordSearch(query: string, limit: number, documentIds?: string[]): Promise<KeywordSearchResult[]>;
  hybridSearch(
    query: string,
    embedding: number[],
    limit: number,
    documentIds?: string[],
  ): Promise<HybridChunkSearchResult[]>;
}
