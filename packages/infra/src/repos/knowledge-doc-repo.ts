import type { KnowledgeDocRepo } from '@wolfkrow/domain';
import { KnowledgeDocument } from '@wolfkrow/domain';
import { eq } from 'drizzle-orm';

import { getDb } from '../db/client';
import { knowledgeDocuments } from '../db/schema/knowledge';

type DbKnowledgeDoc = typeof knowledgeDocuments.$inferSelect;

function toEntity(row: DbKnowledgeDoc): KnowledgeDocument {
  return KnowledgeDocument.fromProps({
    id: row.id,
    userId: row.userId,
    filename: row.filename,
    mimeType: row.mimeType,
    size: row.size,
    status: row.status,
    error: row.error ?? undefined,
    embeddingModel: row.embeddingModel ?? undefined,
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
    chunkCount: row.chunkCount,
    createdAt: row.createdAt ?? new Date(),
    updatedAt: row.updatedAt ?? new Date(),
  });
}

export class DrizzleKnowledgeDocRepo implements KnowledgeDocRepo {
  constructor(private readonly db = getDb()) {}

  async findById(id: string): Promise<KnowledgeDocument | null> {
    const rows = this.db
      .select()
      .from(knowledgeDocuments)
      .where(eq(knowledgeDocuments.id, id))
      .all();
    return rows[0] ? toEntity(rows[0]) : null;
  }

  async findByUserId(userId: string): Promise<KnowledgeDocument[]> {
    const rows = this.db
      .select()
      .from(knowledgeDocuments)
      .where(eq(knowledgeDocuments.userId, userId))
      .all();
    return rows.map(toEntity);
  }

  async save(doc: KnowledgeDocument): Promise<KnowledgeDocument> {
    const p = doc.toProps();
    this.db
      .insert(knowledgeDocuments)
      .values({
        id: p.id,
        userId: p.userId,
        filename: p.filename,
        mimeType: p.mimeType,
        size: p.size,
        status: p.status,
        error: p.error ?? null,
        embeddingModel: p.embeddingModel ?? null,
        metadata: p.metadata,
        chunkCount: p.chunkCount,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      })
      .onConflictDoUpdate({
        target: knowledgeDocuments.id,
        set: {
          status: p.status,
          error: p.error ?? null,
          embeddingModel: p.embeddingModel ?? null,
          metadata: p.metadata,
          chunkCount: p.chunkCount,
          updatedAt: p.updatedAt,
        },
      })
      .run();
    return doc;
  }

  async delete(id: string): Promise<void> {
    this.db.delete(knowledgeDocuments).where(eq(knowledgeDocuments.id, id)).run();
  }
}
