/**
 * Knowledge Benchmark — T38
 *
 * Documents the JS cosine-similarity search behaviour of DrizzleKnowledgeChunkRepo.
 * Uses in-memory SQLite (no disk I/O) and mock embeddings so the suite is fast
 * and free of external dependencies.
 *
 * Goals:
 *  1. Precision@1 = 100% for identical embeddings (exact match retrieval)
 *  2. Similarity ordering is correct (more similar vector ranks higher)
 *  3. Brute-force cosine search over 100 chunks completes in < 50 ms
 */

import { randomUUID } from 'node:crypto';
import { existsSync, unlinkSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { KnowledgeChunk } from '@wolfkrow/domain';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getDb, closeDb } from '../db/client';
import { runMigrations } from '../db/migrate';
import { users } from '../db/schema/auth';
import { knowledgeDocuments, knowledgeChunks } from '../db/schema/knowledge';
import { isVecLoaded } from '../db/vec-extension';
import { cosineSimilarity, DrizzleKnowledgeChunkRepo } from '../repos/knowledge-chunk-repo';

// Resolve migrations folder: __tests__/ is inside src/, which is inside packages/infra/
// So ../../drizzle goes: __tests__ → src → infra → drizzle
const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_FOLDER = path.resolve(MODULE_DIR, '../../drizzle');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Generate a unit vector of `dim` dimensions with a spike at index `spikeAt`. */
function spikeVector(dim: number, spikeAt: number): number[] {
  const v = new Array<number>(dim).fill(0);
  v[spikeAt] = 1;
  return v;
}

/** Generate a random unit vector of `dim` dimensions. */
function randomUnitVector(dim: number): number[] {
  const v = Array.from({ length: dim }, () => Math.random() - 0.5);
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  return norm === 0 ? v : v.map((x) => x / norm);
}

/** Small embedding dimension for tests (real Voyage-3 uses 1024). */
const DIM = 16;

// ---------------------------------------------------------------------------
// Pure function tests (no DB required)
// ---------------------------------------------------------------------------

describe('cosineSimilarity (pure function)', () => {
  it('returns 1 for identical vectors', () => {
    const v = [1, 0, 0];
    expect(cosineSimilarity(v, v)).toBeCloseTo(1);
  });

  it('returns 0 for orthogonal vectors', () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
  });

  it('returns -1 for opposite vectors', () => {
    expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1);
  });

  it('returns 0 for zero vector', () => {
    expect(cosineSimilarity([0, 0, 0], [1, 2, 3])).toBe(0);
  });

  it('returns 0 for mismatched dimensions', () => {
    expect(cosineSimilarity([1, 2], [1, 2, 3])).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Integration tests (require SQLite DB with migrations)
// ---------------------------------------------------------------------------

describe('Knowledge Benchmark — cosine similarity retrieval', () => {
  let testDbPath: string;
  let repo: DrizzleKnowledgeChunkRepo;
  let testDocumentId: string;

  beforeEach(() => {
    testDbPath = path.join(os.tmpdir(), `wolfkrow-kb-bench-${Date.now()}-${Math.random()}.db`);
    process.env.WOLFKROW_DB_PATH = testDbPath;

    runMigrations({ migrationsFolder: MIGRATIONS_FOLDER, dbPath: testDbPath });

    const db = getDb(testDbPath);
    const testUserId = randomUUID();
    testDocumentId = randomUUID();

    // Seed minimal user + document so FK constraints are satisfied
    db.insert(users).values({
      id: testUserId,
      email: 'bench@test.local',
      passwordHash: 'x',
      createdAt: new Date(),
      updatedAt: new Date(),
    }).run();

    db.insert(knowledgeDocuments).values({
      id: testDocumentId,
      userId: testUserId,
      filename: 'bench.txt',
      mimeType: 'text/plain',
      size: 0,
      status: 'ready',
      chunkCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).run();

    repo = new DrizzleKnowledgeChunkRepo(db);
  });

  afterEach(() => {
    closeDb();
    [testDbPath, `${testDbPath}-wal`, `${testDbPath}-shm`].forEach((p) => {
      if (existsSync(p)) unlinkSync(p);
    });
    delete process.env.WOLFKROW_DB_PATH;
  });

  // 1. Precision@1 for chunk #0 -------------------------------------------------
  it('returns chunk #0 as top-1 when queried with its own embedding', async () => {
    const db = getDb(testDbPath);
    const embedding0 = spikeVector(DIM, 0);
    const embedding1 = spikeVector(DIM, 1);

    db.insert(knowledgeChunks).values([
      { id: randomUUID(), documentId: testDocumentId, content: 'chunk zero', embedding: embedding0, position: 0, createdAt: new Date() },
      { id: randomUUID(), documentId: testDocumentId, content: 'chunk one',  embedding: embedding1, position: 1, createdAt: new Date() },
    ]).run();

    const results = await repo.vectorSearch(embedding0, 1);
    expect(results).toHaveLength(1);
    expect(results[0]!.chunk.toProps().content).toBe('chunk zero');
  });

  // 2. Precision@1 for chunk #1 -------------------------------------------------
  it('returns chunk #1 as top-1 when queried with its own embedding', async () => {
    const db = getDb(testDbPath);
    const embedding0 = spikeVector(DIM, 0);
    const embedding1 = spikeVector(DIM, 1);

    db.insert(knowledgeChunks).values([
      { id: randomUUID(), documentId: testDocumentId, content: 'chunk zero', embedding: embedding0, position: 0, createdAt: new Date() },
      { id: randomUUID(), documentId: testDocumentId, content: 'chunk one',  embedding: embedding1, position: 1, createdAt: new Date() },
    ]).run();

    const results = await repo.vectorSearch(embedding1, 1);
    expect(results).toHaveLength(1);
    expect(results[0]!.chunk.toProps().content).toBe('chunk one');
  });

  // 3. Identical embedding → distance = 0 (similarity = 1) --------------------
  it('reports distance = 0 for an identical embedding', async () => {
    const db = getDb(testDbPath);
    const emb = randomUnitVector(DIM);

    db.insert(knowledgeChunks).values({
      id: randomUUID(),
      documentId: testDocumentId,
      content: 'perfect match',
      embedding: emb,
      position: 0,
      createdAt: new Date(),
    }).run();

    const results = await repo.vectorSearch(emb, 1);
    expect(results[0]!.distance).toBeCloseTo(0, 10);
  });

  // 4. Precision@1 ≥ 100% for N distinct embeddings ----------------------------
  it('achieves Precision@1 = 100% for 5 distinct spike embeddings', async () => {
    const db = getDb(testDbPath);
    const N = 5;
    const embeddings = Array.from({ length: N }, (_, i) => spikeVector(DIM, i));

    db.insert(knowledgeChunks).values(
      embeddings.map((emb, i) => ({
        id: randomUUID(),
        documentId: testDocumentId,
        content: `chunk-${i}`,
        embedding: emb,
        position: i,
        createdAt: new Date(),
      }))
    ).run();

    let hits = 0;
    for (let i = 0; i < N; i++) {
      const results = await repo.vectorSearch(embeddings[i]!, 1);
      if (results[0]?.chunk.toProps().content === `chunk-${i}`) hits++;
    }

    const precision = hits / N;
    expect(precision).toBe(1.0);
  });

  // 5. Performance: brute-force search over 100 chunks < 50 ms -----------------
  it('completes vector search over 100 chunks in under 50 ms', async () => {
    const db = getDb(testDbPath);
    const CHUNKS = 100;
    const queryEmbedding = randomUnitVector(DIM);

    const rows = Array.from({ length: CHUNKS }, (_, i) => ({
      id: randomUUID(),
      documentId: testDocumentId,
      content: `perf-chunk-${i}`,
      embedding: randomUnitVector(DIM),
      position: i,
      createdAt: new Date(),
    }));
    db.insert(knowledgeChunks).values(rows).run();

    const t0 = performance.now();
    await repo.vectorSearch(queryEmbedding, 5);
    const elapsed = performance.now() - t0;

    expect(elapsed).toBeLessThan(50);
  });
});

describe('vec0 vector search (T24 Opção A)', () => {
  const VEC_DIM = 1024;
  let testDbPath: string;
  let repo: DrizzleKnowledgeChunkRepo;
  let testDocumentId: string;

  beforeEach(() => {
    testDbPath = path.join(os.tmpdir(), `wolfkrow-vec0-${Date.now()}-${Math.random()}.db`);
    process.env.WOLFKROW_DB_PATH = testDbPath;

    runMigrations({ migrationsFolder: MIGRATIONS_FOLDER, dbPath: testDbPath });

    const db = getDb(testDbPath);
    const testUserId = randomUUID();
    testDocumentId = randomUUID();

    db.insert(users).values({
      id: testUserId,
      email: 'vec0@test.local',
      passwordHash: 'x',
      createdAt: new Date(),
      updatedAt: new Date(),
    }).run();

    db.insert(knowledgeDocuments).values({
      id: testDocumentId,
      userId: testUserId,
      filename: 'vec0.txt',
      mimeType: 'text/plain',
      size: 0,
      status: 'ready',
      chunkCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).run();

    repo = new DrizzleKnowledgeChunkRepo(db);
  });

  afterEach(() => {
    closeDb();
    [testDbPath, `${testDbPath}-wal`, `${testDbPath}-shm`].forEach((p) => {
      if (existsSync(p)) unlinkSync(p);
    });
    delete process.env.WOLFKROW_DB_PATH;
  });

  it.skipIf(!isVecLoaded())('vec0 table created on DB init', () => {
    const sqlite = getDb(testDbPath).$client;
    const row = sqlite.prepare(
      "SELECT 1 FROM sqlite_master WHERE type='table' AND name='knowledge_chunks_vec'",
    ).get();
    expect(row).toBeTruthy();
  });

  it.skipIf(!isVecLoaded())('saveMany populates vec0 for 1024-dim embeddings', async () => {
    const emb = spikeVector(VEC_DIM, 0);
    const chunk = KnowledgeChunk.fromProps({
      id: randomUUID(),
      documentId: testDocumentId,
      content: 'vec0 chunk',
      embedding: emb,
      metadata: { sourceType: 'raw', position: 0 },
      position: 0,
      createdAt: new Date(),
    });

    await repo.saveMany([chunk]);

    const sqlite = getDb(testDbPath).$client;
    const row = sqlite.prepare('SELECT chunk_id FROM knowledge_chunks_vec WHERE chunk_id = ?').get(chunk.toProps().id);
    expect(row).toBeTruthy();
  });

  it.skipIf(!isVecLoaded())('vectorSearch uses vec0 path and returns correct top-1', async () => {
    const emb0 = spikeVector(VEC_DIM, 0);
    const emb1 = spikeVector(VEC_DIM, 1);
    const id0 = randomUUID();
    const id1 = randomUUID();

    await repo.saveMany([
      KnowledgeChunk.fromProps({ id: id0, documentId: testDocumentId, content: 'vec0-chunk-zero', embedding: emb0, metadata: { sourceType: 'raw', position: 0 }, position: 0, createdAt: new Date() }),
      KnowledgeChunk.fromProps({ id: id1, documentId: testDocumentId, content: 'vec0-chunk-one', embedding: emb1, metadata: { sourceType: 'raw', position: 1 }, position: 1, createdAt: new Date() }),
    ]);

    const results = await repo.vectorSearch(emb0, 1);
    expect(results).toHaveLength(1);
    expect(results[0]!.chunk.toProps().content).toBe('vec0-chunk-zero');
    expect(results[0]!.distance).toBeCloseTo(0, 5);
  });

  it.skipIf(!isVecLoaded())('deleteByDocumentId removes chunks from vec0', async () => {
    const emb = spikeVector(VEC_DIM, 5);
    const chunk = KnowledgeChunk.fromProps({
      id: randomUUID(),
      documentId: testDocumentId,
      content: 'to-delete',
      embedding: emb,
      metadata: { sourceType: 'raw', position: 0 },
      position: 0,
      createdAt: new Date(),
    });

    await repo.saveMany([chunk]);
    await repo.deleteByDocumentId(testDocumentId);

    const sqlite = getDb(testDbPath).$client;
    const row = sqlite.prepare('SELECT chunk_id FROM knowledge_chunks_vec WHERE chunk_id = ?').get(chunk.toProps().id);
    expect(row).toBeUndefined();
  });

  it.skipIf(!isVecLoaded())('vec0 search over 100 1024-dim chunks completes in under 100 ms', async () => {
    const CHUNKS = 100;
    const queryEmb = randomUnitVector(VEC_DIM);

    const chunks = Array.from({ length: CHUNKS }, (_, i) =>
      KnowledgeChunk.fromProps({
        id: randomUUID(),
        documentId: testDocumentId,
        content: `perf-${i}`,
        embedding: randomUnitVector(VEC_DIM),
        metadata: { sourceType: 'raw', position: i },
        position: i,
        createdAt: new Date(),
      }),
    );

    await repo.saveMany(chunks);

    const t0 = performance.now();
    await repo.vectorSearch(queryEmb, 5);
    const elapsed = performance.now() - t0;

    expect(elapsed).toBeLessThan(100);
  });
});
