import type { MemorySearchResult, SemanticMemoryRepo } from '@wolfkrow/domain';
import { SemanticMemory } from '@wolfkrow/domain';
import { eq } from 'drizzle-orm';

import { getDb } from '../db/client';
import { semanticMemories } from '../db/schema/memory';

type DbRow = typeof semanticMemories.$inferSelect;

function toEntity(row: DbRow): SemanticMemory {
  return SemanticMemory.fromProps({
    id: row.id,
    userId: row.userId,
    content: row.content,
    embedding: row.embedding ?? undefined,
    source: row.source,
    importance: row.importance,
    accessCount: row.accessCount,
    lastAccessedAt: row.lastAccessedAt ?? undefined,
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
    createdAt: row.createdAt ?? new Date(),
  });
}

export class DrizzleSemanticMemoryRepo implements SemanticMemoryRepo {
  constructor(private readonly db = getDb()) {}

  async findById(id: string): Promise<SemanticMemory | null> {
    const rows = this.db.select().from(semanticMemories).where(eq(semanticMemories.id, id)).all();
    return rows[0] ? toEntity(rows[0]) : null;
  }

  async findByUserId(userId: string, limit?: number): Promise<SemanticMemory[]> {
    const q = this.db.select().from(semanticMemories)
      .where(eq(semanticMemories.userId, userId))
      .orderBy(semanticMemories.createdAt);
    const rows = limit ? q.limit(limit).all() : q.all();
    return rows.map(toEntity);
  }

  async save(memory: SemanticMemory): Promise<SemanticMemory> {
    const p = memory.toProps();
    this.db.insert(semanticMemories).values({
      id: p.id,
      userId: p.userId,
      content: p.content,
      embedding: p.embedding ?? null,
      source: p.source,
      importance: p.importance,
      accessCount: p.accessCount,
      lastAccessedAt: p.lastAccessedAt ?? null,
      metadata: p.metadata,
      createdAt: p.createdAt,
    }).onConflictDoUpdate({
      target: semanticMemories.id,
      set: {
        content: p.content,
        embedding: p.embedding ?? null,
        importance: p.importance,
        accessCount: p.accessCount,
        lastAccessedAt: p.lastAccessedAt ?? null,
        metadata: p.metadata,
      },
    }).run();
    return memory;
  }

  async delete(id: string): Promise<void> {
    this.db.delete(semanticMemories).where(eq(semanticMemories.id, id)).run();
  }

  async deleteByUserId(userId: string): Promise<void> {
    this.db.delete(semanticMemories).where(eq(semanticMemories.userId, userId)).run();
  }

  async vectorSearch(embedding: number[], userId: string, limit: number): Promise<MemorySearchResult[]> {
    const embeddingJson = JSON.stringify(embedding);
    const sql = `
      SELECT id, user_id, content, embedding, source, importance, access_count, last_accessed_at,
             metadata, created_at,
             vec_distance_cosine(embedding, ?) AS distance
      FROM semantic_memories
      WHERE user_id = ? AND embedding IS NOT NULL
      ORDER BY distance
      LIMIT ?
    `;
    try {
      const rows = this.db.$client.prepare(sql).all(embeddingJson, userId, limit) as (DbRow & { distance: number })[];
      return rows.map((r) => ({ memory: toEntity(r), distance: r.distance }));
    } catch {
      return [];
    }
  }
}
