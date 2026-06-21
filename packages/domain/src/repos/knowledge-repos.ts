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

export interface KnowledgeChunkRepo {
  saveMany(chunks: KnowledgeChunk[]): Promise<KnowledgeChunk[]>;
  findByDocumentId(documentId: string): Promise<KnowledgeChunk[]>;
  deleteByDocumentId(documentId: string): Promise<void>;
  vectorSearch(embedding: number[], limit: number, documentIds?: string[]): Promise<ChunkSearchResult[]>;
  keywordSearch(query: string, limit: number, documentIds?: string[]): Promise<KeywordSearchResult[]>;
}
