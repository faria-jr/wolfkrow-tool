import type { MemorySearchResult, SemanticMemoryRepo } from '@wolfkrow/domain';
import { SemanticMemory } from '@wolfkrow/domain';
import { and, eq, isNotNull } from 'drizzle-orm';

import { getDb } from '../db/client';
import { semanticMemories } from '../db/schema/memory';

import { cosineSimilarity } from './knowledge-chunk-repo';

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
    const rows = this.db
      .select()
      .from(semanticMemories)
      .where(and(eq(semanticMemories.userId, userId), isNotNull(semanticMemories.embedding)))
      .all();

    return rows
      .map((r) => {
        const emb = r.embedding;
        if (!Array.isArray(emb) || emb.length !== embedding.length) return null;
        return { row: r, distance: 1 - cosineSimilarity(embedding, emb) };
      })
      .filter((x): x is { row: DbRow; distance: number } => x !== null)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, limit)
      .map(({ row, distance }) => ({ memory: toEntity(row), distance }));
  }
}
