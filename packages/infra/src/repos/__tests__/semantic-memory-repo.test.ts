/**
 * Tests: T24 — DrizzleSemanticMemoryRepo.vectorSearch (brute-force JS cosine).
 */

import { SemanticMemory } from '@wolfkrow/domain';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { describe, expect, it } from 'vitest';

import * as schema from '../../db/schema';
import { DrizzleSemanticMemoryRepo } from '../semantic-memory-repo';

function makeRepo() {
  const sqlite = new Database(':memory:');
  sqlite.exec(`
    CREATE TABLE semantic_memories (
      id text PRIMARY KEY NOT NULL,
      user_id text NOT NULL,
      content text NOT NULL,
      embedding text,
      source text NOT NULL DEFAULT 'chat',
      importance real NOT NULL DEFAULT 0.5,
      access_count integer NOT NULL DEFAULT 0,
      last_accessed_at integer,
      metadata text,
      created_at integer NOT NULL
    );
  `);
  const db = drizzle(sqlite, { schema });
  return new DrizzleSemanticMemoryRepo(db);
}

function mem(id: string, content: string, embedding: number[] | undefined): SemanticMemory {
  return SemanticMemory.fromProps({
    id,
    userId: 'user-1',
    content,
    embedding,
    source: 'conversation',
    importance: 0.5,
    accessCount: 0,
    lastAccessedAt: undefined,
    metadata: {},
    createdAt: new Date(),
  });
}

describe('DrizzleSemanticMemoryRepo.vectorSearch (T24)', () => {
  it('returns results ordered by cosine distance (closest first)', async () => {
    const repo = makeRepo();
    await repo.save(mem('a', 'alpha', [1, 0, 0]));
    await repo.save(mem('b', 'beta', [0, 1, 0]));
    await repo.save(mem('c', 'gamma', [0.9, 0.1, 0]));

    const results = await repo.vectorSearch([1, 0, 0], 'user-1', 5);
    expect(results.length).toBe(3);
    expect(results[0]!.memory.id).toBe('a');
    expect(results[0]!.distance).toBeCloseTo(0);
    expect(results[1]!.memory.id).toBe('c');
    expect(results[2]!.memory.id).toBe('b');
  });

  it('respects the limit parameter', async () => {
    const repo = makeRepo();
    await repo.save(mem('a', 'alpha', [1, 0, 0]));
    await repo.save(mem('b', 'beta', [0, 1, 0]));
    await repo.save(mem('c', 'gamma', [0, 0, 1]));

    const results = await repo.vectorSearch([1, 0, 0], 'user-1', 1);
    expect(results).toHaveLength(1);
    expect(results[0]!.memory.id).toBe('a');
  });

  it('filters by userId', async () => {
    const repo = makeRepo();
    await repo.save(SemanticMemory.fromProps({ id: 'u1', userId: 'alice', content: 'alice mem', embedding: [1, 0], source: 'conversation', importance: 0.5, accessCount: 0, lastAccessedAt: undefined, metadata: {}, createdAt: new Date() }));
    await repo.save(SemanticMemory.fromProps({ id: 'u2', userId: 'bob', content: 'bob mem', embedding: [1, 0], source: 'conversation', importance: 0.5, accessCount: 0, lastAccessedAt: undefined, metadata: {}, createdAt: new Date() }));

    const results = await repo.vectorSearch([1, 0], 'alice', 10);
    expect(results).toHaveLength(1);
    expect(results[0]!.memory.content).toBe('alice mem');
  });

  it('skips memories with no embedding', async () => {
    const repo = makeRepo();
    await repo.save(mem('a', 'with embedding', [1, 0, 0]));
    await repo.save(mem('b', 'no embedding', undefined));

    const results = await repo.vectorSearch([1, 0, 0], 'user-1', 10);
    expect(results).toHaveLength(1);
    expect(results[0]!.memory.id).toBe('a');
  });
});
