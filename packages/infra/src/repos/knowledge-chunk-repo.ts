import type {
  ChunkMetadata,
  ChunkSearchResult,
  HybridChunkSearchResult,
  KeywordSearchResult,
  KnowledgeChunkRepo,
} from '@wolfkrow/domain';
import { KnowledgeChunk } from '@wolfkrow/domain';
import { and, eq, inArray, isNotNull, sql } from 'drizzle-orm';

import { getDb, type DatabaseClient } from '../db/client';
import { knowledgeChunks } from '../db/schema/knowledge';

import { cosineSimilarity } from './knowledge-cosine';
import { hasTable, swallowVecError, VEC_DIM, type SqliteStatement } from './knowledge-helpers';
import {
  fuseHybridResults,
  isFtsAvailable,
  isVec0Available,
  keywordSearchFts5,
  vectorSearchVec0,
} from './knowledge-hybrid';

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

interface ChunkProjectionStmts {
  vec0Insert: SqliteStatement | null;
  ftsDelete: SqliteStatement | null;
  ftsInsert: SqliteStatement | null;
}

export class DrizzleKnowledgeChunkRepo implements KnowledgeChunkRepo {
  constructor(private readonly db = getDb()) {}

  async saveMany(chunks: KnowledgeChunk[]): Promise<KnowledgeChunk[]> {
    const stmts = this.prepareProjectionStmts(this.db.$client);

    for (const chunk of chunks) {
      this.persistChunk(chunk, stmts);
    }
    return chunks;
  }

  private prepareProjectionStmts(sqlite: DatabaseClient['$client']): ChunkProjectionStmts {
    const stmts: ChunkProjectionStmts = {
      vec0Insert: null,
      ftsDelete: null,
      ftsInsert: null,
    };
    if (hasTable(sqlite, 'knowledge_chunks_vec')) {
      stmts.vec0Insert = sqlite.prepare(
        'INSERT OR REPLACE INTO knowledge_chunks_vec (chunk_id, embedding) VALUES (?, ?)'
      );
    }
    if (hasTable(sqlite, 'knowledge_chunks_fts')) {
      stmts.ftsDelete = sqlite.prepare('DELETE FROM knowledge_chunks_fts WHERE chunk_id = ?');
      stmts.ftsInsert = sqlite.prepare(
        'INSERT INTO knowledge_chunks_fts (chunk_id, content) VALUES (?, ?)'
      );
    }
    return stmts;
  }

  private persistChunk(chunk: KnowledgeChunk, stmts: ChunkProjectionStmts): void {
    const p = chunk.toProps();
    const sqlite = this.db.$client;

    // Wrap primary insert + shadow-index writes in a single transaction so
    // the primary row and its search projections are always consistent.
    sqlite.transaction(() => {
      this.db
        .insert(knowledgeChunks)
        .values({
          id: p.id,
          documentId: p.documentId,
          content: p.content,
          embedding: p.embedding ?? null,
          metadata: p.metadata,
          position: p.position,
          createdAt: p.createdAt,
        })
        .run();

      const { vec0Insert, ftsDelete, ftsInsert } = stmts;
      if (vec0Insert && p.embedding && p.embedding.length === VEC_DIM) {
        swallowVecError(() => vec0Insert.run(p.id, JSON.stringify(p.embedding)));
      }
      if (ftsDelete && ftsInsert) {
        ftsDelete.run(p.id);
        ftsInsert.run(p.id, p.content);
      }
    })();
  }

  async findByDocumentId(documentId: string): Promise<KnowledgeChunk[]> {
    const rows = this.db
      .select()
      .from(knowledgeChunks)
      .where(eq(knowledgeChunks.documentId, documentId))
      .all();
    return rows.map(toEntity);
  }

  async deleteByDocumentId(documentId: string): Promise<void> {
    const sqlite = this.db.$client;
    const ids = this.db
      .select({ id: knowledgeChunks.id })
      .from(knowledgeChunks)
      .where(eq(knowledgeChunks.documentId, documentId))
      .all()
      .map((r) => r.id);

    if (ids.length > 0) {
      const placeholders = ids.map(() => '?').join(', ');
      if (hasTable(sqlite, 'knowledge_chunks_vec')) {
        sqlite
          .prepare(`DELETE FROM knowledge_chunks_vec WHERE chunk_id IN (${placeholders})`)
          .run(...ids);
      }
      if (hasTable(sqlite, 'knowledge_chunks_fts')) {
        sqlite
          .prepare(`DELETE FROM knowledge_chunks_fts WHERE chunk_id IN (${placeholders})`)
          .run(...ids);
      }
    }

    this.db.delete(knowledgeChunks).where(eq(knowledgeChunks.documentId, documentId)).run();
  }

  async vectorSearch(
    embedding: number[],
    limit: number,
    documentIds?: string[]
  ): Promise<ChunkSearchResult[]> {
    if (embedding.length === VEC_DIM && isVec0Available(this.db.$client)) {
      return vectorSearchVec0(this.db, {
        embedding,
        limit,
        documentIds,
        toEntity,
      });
    }
    return this.vectorSearchJS(embedding, limit, documentIds);
  }

  private vectorSearchJS(
    embedding: number[],
    limit: number,
    documentIds?: string[]
  ): ChunkSearchResult[] {
    const where = and(
      isNotNull(knowledgeChunks.embedding),
      documentIds && documentIds.length > 0
        ? inArray(knowledgeChunks.documentId, documentIds)
        : undefined
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

  async keywordSearch(
    query: string,
    limit: number,
    documentIds?: string[]
  ): Promise<KeywordSearchResult[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];

    if (isFtsAvailable(this.db.$client)) {
      return keywordSearchFts5(this.db, {
        query: trimmed,
        limit,
        documentIds,
        toEntity,
      });
    }
    return this.keywordSearchLike(trimmed, limit, documentIds);
  }

  private keywordSearchLike(
    query: string,
    limit: number,
    documentIds?: string[]
  ): KeywordSearchResult[] {
    // Escape LIKE metacharacters so user input is treated literally.
    const escaped = query.replace(/[%_\\]/g, '\\$&');
    const pattern = `%${escaped}%`;
    const where = and(
      sql`${knowledgeChunks.content} LIKE ${pattern} ESCAPE '\\'`,
      documentIds && documentIds.length > 0
        ? inArray(knowledgeChunks.documentId, documentIds)
        : undefined
    );
    const rows = this.db.select().from(knowledgeChunks).where(where).all();
    return rows.slice(0, limit).map((row) => ({ chunk: toEntity(row), rank: 0 }));
  }

  async hybridSearch(
    query: string,
    embedding: number[],
    limit: number,
    documentIds?: string[]
  ): Promise<HybridChunkSearchResult[]> {
    const fetchLimit = Math.max(limit * 3, 30);
    const [vecResults, kwResults] = await Promise.all([
      this.vectorSearch(embedding, fetchLimit, documentIds),
      this.keywordSearch(query, fetchLimit, documentIds),
    ]);
    return fuseHybridResults(vecResults, kwResults, limit);
  }
}
