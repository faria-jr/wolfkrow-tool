import type { ChunkMetadata, ChunkSearchResult, KeywordSearchResult, KnowledgeChunkRepo } from '@wolfkrow/domain';
import { KnowledgeChunk } from '@wolfkrow/domain';
import { and, eq, inArray, isNotNull, like } from 'drizzle-orm';

import { getDb } from '../db/client';
import { knowledgeChunks } from '../db/schema/knowledge';

type DbChunk = typeof knowledgeChunks.$inferSelect;

function toMeta(row: DbChunk): ChunkMetadata {
  const raw = (row.metadata ?? {}) as { sourceType?: string; heading?: string; position?: number };
  const meta: ChunkMetadata = {
    sourceType: (raw.sourceType as ChunkMetadata['sourceType']) ?? 'raw',
    position: raw.position ?? row.position,
  };
  if (raw.heading !== undefined) meta.heading = raw.heading;
  return meta;
}

function toEntity(row: DbChunk): KnowledgeChunk {
  return KnowledgeChunk.fromProps({
    id: row.id,
    documentId: row.documentId,
    content: row.content,
    embedding: row.embedding as number[] | undefined,
    metadata: toMeta(row),
    position: row.position,
    createdAt: row.createdAt ?? new Date(),
  });
}

/**
 * Cosine similarity between two equal-length vectors. Returns 0 for a zero
 * vector (avoids divide-by-zero). Range: [-1, 1], higher = more similar.
 *
 * Used for in-app vector search over embeddings stored as JSON (FIX-002):
 * the previous impl called sqlite-vec's vec_distance_cosine on a JSON text
 * column with no vec0 virtual table → it always threw and the search
 * silently returned []. Computing cosine in JS over the persisted embeddings
 * works with the existing schema and is fine for a local single-user corpus.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    const av = a[i]!;
    const bv = b[i]!;
    dot += av * bv;
    normA += av * av;
    normB += bv * bv;
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

export class DrizzleKnowledgeChunkRepo implements KnowledgeChunkRepo {
  constructor(private readonly db = getDb()) {}

  async saveMany(chunks: KnowledgeChunk[]): Promise<KnowledgeChunk[]> {
    for (const chunk of chunks) {
      const p = chunk.toProps();
      this.db.insert(knowledgeChunks).values({
        id: p.id,
        documentId: p.documentId,
        content: p.content,
        embedding: p.embedding ?? null,
        metadata: p.metadata,
        position: p.position,
        createdAt: p.createdAt,
      }).run();
    }
    return chunks;
  }

  async findByDocumentId(documentId: string): Promise<KnowledgeChunk[]> {
    const rows = this.db.select().from(knowledgeChunks).where(eq(knowledgeChunks.documentId, documentId)).all();
    return rows.map(toEntity);
  }

  async deleteByDocumentId(documentId: string): Promise<void> {
    this.db.delete(knowledgeChunks).where(eq(knowledgeChunks.documentId, documentId)).run();
  }

  async vectorSearch(embedding: number[], limit: number, documentIds?: string[]): Promise<ChunkSearchResult[]> {
    const where = and(
      isNotNull(knowledgeChunks.embedding),
      documentIds && documentIds.length > 0 ? inArray(knowledgeChunks.documentId, documentIds) : undefined,
    );
    const rows = this.db.select().from(knowledgeChunks).where(where).all();

    return rows
      .map((row) => {
        const emb = row.embedding;
        if (!Array.isArray(emb) || emb.length !== embedding.length) return null;
        return { row, distance: 1 - cosineSimilarity(embedding, emb) };
      })
      .filter((x): x is { row: DbChunk; distance: number } => x !== null)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, limit)
      .map(({ row, distance }) => ({ chunk: toEntity(row), distance }));
  }

  async keywordSearch(query: string, limit: number, documentIds?: string[]): Promise<KeywordSearchResult[]> {
    const pattern = `%${query}%`;
    const where = and(
      like(knowledgeChunks.content, pattern),
      documentIds && documentIds.length > 0 ? inArray(knowledgeChunks.documentId, documentIds) : undefined,
    );
    const rows = this.db.select().from(knowledgeChunks).where(where).all();
    return rows
      .slice(0, limit)
      .map((row) => ({ chunk: toEntity(row), rank: 0 }));
  }
}
