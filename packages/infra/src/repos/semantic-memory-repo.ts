import type {
  HybridMemorySearchResult,
  MemorySearchResult,
  SemanticMemoryRepo,
} from '@wolfkrow/domain';
import { SemanticMemory } from '@wolfkrow/domain';
import { and, eq, isNotNull } from 'drizzle-orm';

import { getDb, type DatabaseClient } from '../db/client';
import { semanticMemories } from '../db/schema/memory';

import { cosineSimilarity } from './knowledge-cosine';

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

function hasVec0Table(sqlite: DatabaseClient['$client'], name: string): boolean {
  return (
    sqlite
      .prepare(`SELECT 1 FROM sqlite_master WHERE type='table' AND name=?`)
      .get(name) != null
  );
}

const VEC_DIM = 1024;
const RRF_K = 60;

interface RankedMemory {
  id: string;
  rank: number;
}

function reciprocalRankFusion(ranksLists: RankedMemory[][]): Map<string, number> {
  const scores = new Map<string, number>();
  for (const list of ranksLists) {
    list.forEach((entry, idx) => {
      const rrf = 1 / (RRF_K + idx + 1);
      scores.set(entry.id, (scores.get(entry.id) ?? 0) + rrf);
    });
  }
  return scores;
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
    const sqlite = this.db.$client;
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

    if (p.embedding && p.embedding.length === VEC_DIM && hasVec0Table(sqlite, 'semantic_memories_vec')) {
      const vec0Stmt = sqlite.prepare(
        'INSERT OR REPLACE INTO semantic_memories_vec (memory_id, embedding) VALUES (?, ?)',
      );
      try {
        vec0Stmt.run(p.id, JSON.stringify(p.embedding));
      } catch {
        // vec0 failure is non-fatal — JS cosine fallback handles vectorSearch
      }
    }

    return memory;
  }

  async delete(id: string): Promise<void> {
    const sqlite = this.db.$client;
    if (hasVec0Table(sqlite, 'semantic_memories_vec')) {
      sqlite.prepare('DELETE FROM semantic_memories_vec WHERE memory_id = ?').run(id);
    }
    this.db.delete(semanticMemories).where(eq(semanticMemories.id, id)).run();
  }

  async deleteByUserId(userId: string): Promise<void> {
    const sqlite = this.db.$client;
    const ids = this.db
      .select({ id: semanticMemories.id })
      .from(semanticMemories)
      .where(eq(semanticMemories.userId, userId))
      .all()
      .map((r) => r.id);

    if (ids.length > 0 && hasVec0Table(sqlite, 'semantic_memories_vec')) {
      const placeholders = ids.map(() => '?').join(', ');
      sqlite
        .prepare(`DELETE FROM semantic_memories_vec WHERE memory_id IN (${placeholders})`)
        .run(...ids);
    }
    this.db.delete(semanticMemories).where(eq(semanticMemories.userId, userId)).run();
  }

  async vectorSearch(
    embedding: number[],
    userId: string,
    limit: number,
  ): Promise<MemorySearchResult[]> {
    const sqlite = this.db.$client;
    if (embedding.length === VEC_DIM && hasVec0Table(sqlite, 'semantic_memories_vec')) {
      return this.vectorSearchVec0(sqlite, embedding, userId, limit);
    }
    return this.vectorSearchJS(embedding, userId, limit);
  }

  private vectorSearchVec0(
    sqlite: DatabaseClient['$client'],
    embedding: number[],
    userId: string,
    limit: number,
  ): MemorySearchResult[] {
    const candidates = sqlite
      .prepare(
        `SELECT v.memory_id, v.distance
         FROM semantic_memories_vec v
         JOIN semantic_memories m ON m.id = v.memory_id
         WHERE v.embedding MATCH ?
           AND m.user_id = ?
         ORDER BY v.distance
         LIMIT ?`,
      )
      .all(JSON.stringify(embedding), userId, limit * 10) as Array<{
      memory_id: string;
      distance: number;
    }>;

    const results: MemorySearchResult[] = [];
    for (const { memory_id, distance } of candidates) {
      if (results.length >= limit) break;
      const row = this.db
        .select()
        .from(semanticMemories)
        .where(and(eq(semanticMemories.id, memory_id), eq(semanticMemories.userId, userId)))
        .get();
      if (!row) continue;
      results.push({ memory: toEntity(row), distance });
    }
    return results;
  }

  private vectorSearchJS(
    embedding: number[],
    userId: string,
    limit: number,
  ): MemorySearchResult[] {
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

  async hybridSearch(
    embedding: number[],
    userId: string,
    limit: number,
  ): Promise<HybridMemorySearchResult[]> {
    const fetchLimit = Math.max(limit * 3, 30);
    const vecResults = await this.vectorSearch(embedding, userId, fetchLimit);

    const ranks: RankedMemory[] = vecResults.map((r, idx) => ({
      id: r.memory.toProps().id,
      rank: idx,
    }));
    const fused = reciprocalRankFusion([ranks]);
    const distanceById = new Map<string, number>();
    for (const r of vecResults) distanceById.set(r.memory.toProps().id, r.distance);

    return Array.from(fused.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit)
      .map(([id, score]) => {
        const result = vecResults.find((r) => r.memory.toProps().id === id);
        if (!result) throw new Error(`hybridSearch: missing memory for fused id ${id}`);
        const fused: HybridMemorySearchResult = {
          memory: result.memory,
          score,
        };
        const dist = distanceById.get(id);
        if (dist !== undefined) fused.vectorDistance = dist;
        return fused;
      });
  }
}
