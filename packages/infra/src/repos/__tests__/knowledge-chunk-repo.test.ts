import { KnowledgeChunk } from '@wolfkrow/domain';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { describe, expect, it } from 'vitest';

import * as schema from '../../db/schema';
import { DrizzleKnowledgeChunkRepo } from '../knowledge-chunk-repo';
import { cosineSimilarity } from '../knowledge-cosine';

function makeRepo() {
  const sqlite = new Database(':memory:');
  sqlite.exec(`
    CREATE TABLE knowledge_chunks (
      id text PRIMARY KEY NOT NULL,
      document_id text NOT NULL,
      content text NOT NULL,
      embedding text,
      metadata text,
      position integer NOT NULL,
      created_at integer NOT NULL
    );
  `);
  const db = drizzle(sqlite, { schema });
  return new DrizzleKnowledgeChunkRepo(db);
}

function chunk(id: string, content: string, embedding: number[] | undefined): KnowledgeChunk {
  return KnowledgeChunk.fromProps({
    id,
    documentId: 'doc-1',
    content,
    embedding,
    metadata: { sourceType: 'raw', position: 0 },
    position: 0,
    createdAt: new Date(),
  });
}

describe('cosineSimilarity (unit)', () => {
  it('is 1 for identical vectors', () => {
    expect(cosineSimilarity([1, 0, 0], [1, 0, 0])).toBeCloseTo(1);
  });
  it('is 0 for orthogonal vectors', () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
  });
  it('returns 0 for mismatched lengths or empty', () => {
    expect(cosineSimilarity([1, 0], [1])).toBe(0);
    expect(cosineSimilarity([], [])).toBe(0);
  });
});

describe('DrizzleKnowledgeChunkRepo search', () => {
  it('vectorSearch ranks chunks by cosine similarity (distance ascending)', async () => {
    const repo = makeRepo();
    await repo.saveMany([
      chunk('a', 'alpha', [1, 0, 0]),
      chunk('b', 'beta gamma', [0, 1, 0]),
      chunk('c', 'no embedding here', undefined),
    ]);

    const results = await repo.vectorSearch([1, 0, 0], 5);
    expect(results.length).toBe(2);
    expect(results[0]!.chunk.id).toBe('a');
    expect(results[0]!.distance).toBeCloseTo(0);
    expect(results[1]!.chunk.id).toBe('b');
  });

  it('vectorSearch respects the limit', async () => {
    const repo = makeRepo();
    await repo.saveMany([
      chunk('a', 'alpha', [1, 0, 0]),
      chunk('b', 'beta', [0.9, 0.1, 0]),
    ]);
    const results = await repo.vectorSearch([1, 0, 0], 1);
    expect(results).toHaveLength(1);
    expect(results[0]!.chunk.id).toBe('a');
  });

  it('keywordSearch matches content via LIKE', async () => {
    const repo = makeRepo();
    await repo.saveMany([
      chunk('a', 'machine learning overview', undefined),
      chunk('b', 'deep learning networks', undefined),
      chunk('c', 'unrelated cooking recipe', undefined),
    ]);
    const results = await repo.keywordSearch('learning', 10);
    const ids = results.map((r) => r.chunk.id).sort();
    expect(ids).toEqual(['a', 'b']);
  });

  it('keywordSearch respects the limit', async () => {
    const repo = makeRepo();
    await repo.saveMany([
      chunk('a', 'learning one', undefined),
      chunk('b', 'learning two', undefined),
      chunk('c', 'learning three', undefined),
    ]);
    const results = await repo.keywordSearch('learning', 2);
    expect(results).toHaveLength(2);
  });
});

describe('DrizzleKnowledgeChunkRepo.hybridSearch (M4)', () => {
  it('returns only keyword-strategy results when vector has no match (orthogonal)', async () => {
    const repo = makeRepo();
    await repo.saveMany([chunk('a', 'unrelated content', [0, 0, 1])]);
    const results = await repo.hybridSearch('totally missing terms', [1, 0, 0], 5);
    // vector returns 'a' (orthogonal, distance 1), keyword returns nothing
    // → hybrid still returns 'a' from the vector strategy only
    expect(results.length).toBe(1);
    expect(results[0]!.chunk.id).toBe('a');
    expect(results[0]!.vectorDistance).toEqual(expect.any(Number));
    expect(results[0]!.keywordRank).toBeUndefined();
  });

  it('fuses vector and keyword hits and assigns a score', async () => {
    const repo = makeRepo();
    await repo.saveMany([
      chunk('a', 'machine learning overview', [1, 0, 0]),
      chunk('b', 'unrelated cooking recipe', [0, 1, 0]),
      chunk('c', 'machine learning deep dive', [0.95, 0.05, 0]),
    ]);
    const results = await repo.hybridSearch('machine learning', [1, 0, 0], 5);
    expect(results.length).toBeGreaterThanOrEqual(2);
    expect(results[0]!.chunk.id).toMatch(/a|c/);
    expect(results[0]!.score).toBeGreaterThan(0);
    // 'a' or 'c' are returned in both vector and keyword strategies → both
    // per-strategy fields populated
    const a = results.find((r) => r.chunk.id === 'a');
    const c = results.find((r) => r.chunk.id === 'c');
    expect(a?.vectorDistance).toEqual(expect.any(Number));
    expect(a?.keywordRank).toEqual(expect.any(Number));
    expect(c?.vectorDistance).toEqual(expect.any(Number));
    expect(c?.keywordRank).toEqual(expect.any(Number));
    // 'b' matches the embedding but not the keyword
    const b = results.find((r) => r.chunk.id === 'b');
    expect(b).toBeDefined();
    expect(b?.vectorDistance).toEqual(expect.any(Number));
    expect(b?.keywordRank).toBeUndefined();
  });

  it('respects the limit', async () => {
    const repo = makeRepo();
    await repo.saveMany([
      chunk('a', 'machine learning 1', [1, 0, 0]),
      chunk('b', 'machine learning 2', [0.9, 0.1, 0]),
      chunk('c', 'machine learning 3', [0.8, 0.2, 0]),
    ]);
    const results = await repo.hybridSearch('machine', [1, 0, 0], 2);
    expect(results).toHaveLength(2);
  });
});
