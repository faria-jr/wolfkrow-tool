import { KnowledgeChunk } from '@wolfkrow/domain';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { describe, expect, it } from 'vitest';

import * as schema from '../../db/schema';
import { cosineSimilarity, DrizzleKnowledgeChunkRepo } from '../knowledge-chunk-repo';

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
