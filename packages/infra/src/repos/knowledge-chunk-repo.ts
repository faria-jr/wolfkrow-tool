import type { ChunkMetadata, ChunkSearchResult, KeywordSearchResult, KnowledgeChunkRepo } from '@wolfkrow/domain';
import { KnowledgeChunk } from '@wolfkrow/domain';
import { and, eq, inArray, isNotNull, like } from 'drizzle-orm';

import { getDb, type DatabaseClient } from '../db/client';
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
 * Exported for reuse by SemanticMemoryRepo and tests.
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

function hasVec0Table(sqlite: DatabaseClient['$client']): boolean {
  return (
    sqlite
      .prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='knowledge_chunks_vec'")
      .get() != null
  );
}

export class DrizzleKnowledgeChunkRepo implements KnowledgeChunkRepo {
  constructor(private readonly db = getDb()) {}

  async saveMany(chunks: KnowledgeChunk[]): Promise<KnowledgeChunk[]> {
    const sqlite = this.db.$client;
    const useVec0 = hasVec0Table(sqlite);
    const vec0Stmt = useVec0
      ? sqlite.prepare('INSERT OR REPLACE INTO knowledge_chunks_vec (chunk_id, embedding) VALUES (?, ?)')
      : null;

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

      if (vec0Stmt && p.embedding && p.embedding.length === 1024) {
        try {
          vec0Stmt.run(p.id, JSON.stringify(p.embedding));
        } catch {
          // vec0 insert failure is non-fatal — JS cosine fallback still works
        }
      }
    }
    return chunks;
  }

  async findByDocumentId(documentId: string): Promise<KnowledgeChunk[]> {
    const rows = this.db.select().from(knowledgeChunks).where(eq(knowledgeChunks.documentId, documentId)).all();
    return rows.map(toEntity);
  }

  async deleteByDocumentId(documentId: string): Promise<void> {
    const sqlite = this.db.$client;

    if (hasVec0Table(sqlite)) {
      const ids = this.db
        .select({ id: knowledgeChunks.id })
        .from(knowledgeChunks)
        .where(eq(knowledgeChunks.documentId, documentId))
        .all()
        .map((r) => r.id);

      if (ids.length > 0) {
        const placeholders = ids.map(() => '?').join(', ');
        sqlite.prepare(`DELETE FROM knowledge_chunks_vec WHERE chunk_id IN (${placeholders})`).run(...ids);
      }
    }

    this.db.delete(knowledgeChunks).where(eq(knowledgeChunks.documentId, documentId)).run();
  }

  async vectorSearch(embedding: number[], limit: number, documentIds?: string[]): Promise<ChunkSearchResult[]> {
    const sqlite = this.db.$client;

    if (embedding.length === 1024 && hasVec0Table(sqlite)) {
      return this.vectorSearchVec0(sqlite, embedding, limit, documentIds);
    }

    return this.vectorSearchJS(embedding, limit, documentIds);
  }

  private vectorSearchVec0(
    sqlite: DatabaseClient['$client'],
    embedding: number[],
    limit: number,
    documentIds?: string[],
  ): ChunkSearchResult[] {
    const queryLimit = documentIds && documentIds.length > 0 ? limit * 10 : limit;
    const candidates = sqlite
      .prepare(
        `SELECT chunk_id, distance
         FROM knowledge_chunks_vec
         WHERE embedding MATCH ?
         ORDER BY distance
         LIMIT ?`,
      )
      .all(JSON.stringify(embedding), queryLimit) as Array<{ chunk_id: string; distance: number }>;

    const results: ChunkSearchResult[] = [];
    for (const { chunk_id, distance } of candidates) {
      if (results.length >= limit) break;
      const row = this.db.select().from(knowledgeChunks).where(eq(knowledgeChunks.id, chunk_id)).get();
      if (!row) continue;
      if (documentIds && documentIds.length > 0 && !documentIds.includes(row.documentId)) continue;
      results.push({ chunk: toEntity(row), distance });
    }
    return results;
  }

  private vectorSearchJS(embedding: number[], limit: number, documentIds?: string[]): ChunkSearchResult[] {
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
