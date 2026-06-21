import type { ChunkMetadata, ChunkSearchResult, KeywordSearchResult, KnowledgeChunkRepo } from '@wolfkrow/domain';
import { KnowledgeChunk } from '@wolfkrow/domain';
import { eq } from 'drizzle-orm';

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
    const embeddingJson = JSON.stringify(embedding);
    let sql = `
      SELECT kc.id, kc.document_id, kc.content, kc.embedding, kc.metadata, kc.position, kc.created_at,
             vec_distance_cosine(kc.embedding, ?) AS distance
      FROM knowledge_chunks kc
      WHERE kc.embedding IS NOT NULL
    `;
    const params: unknown[] = [embeddingJson];

    if (documentIds && documentIds.length > 0) {
      sql += ` AND kc.document_id IN (${documentIds.map(() => '?').join(',')})`;
      params.push(...documentIds);
    }
    sql += ` ORDER BY distance LIMIT ?`;
    params.push(limit);

    try {
      const rows = this.db.$client.prepare(sql).all(...params) as (DbChunk & { distance: number })[];
      return rows.map((r) => ({ chunk: toEntity(r), distance: r.distance }));
    } catch {
      return [];
    }
  }

  async keywordSearch(query: string, limit: number, documentIds?: string[]): Promise<KeywordSearchResult[]> {
    let sql = `
      SELECT kc.id, kc.document_id, kc.content, kc.embedding, kc.metadata, kc.position, kc.created_at,
             bm25(knowledge_chunks_fts) AS rank
      FROM knowledge_chunks_fts
      JOIN knowledge_chunks kc ON kc.id = knowledge_chunks_fts.rowid
      WHERE knowledge_chunks_fts MATCH ?
    `;
    const params: unknown[] = [query];

    if (documentIds && documentIds.length > 0) {
      sql += ` AND kc.document_id IN (${documentIds.map(() => '?').join(',')})`;
      params.push(...documentIds);
    }
    sql += ` ORDER BY rank LIMIT ?`;
    params.push(limit);

    try {
      const rows = this.db.$client.prepare(sql).all(...params) as (DbChunk & { rank: number })[];
      return rows.map((r) => ({ chunk: toEntity(r), rank: r.rank }));
    } catch {
      return [];
    }
  }
}
