/**
 * Knowledge engine native extensions (sqlite-vec + FTS5).
 *
 * M4 — Knowledge Engine: load sqlite-vec for O(log n) vector search via vec0
 * and create the FTS5 virtual tables for keyword search. All tables are
 * shadow projections of the canonical Drizzle-managed tables (knowledge_chunks
 * and semantic_memories) — the canonical tables remain the source of truth.
 *
 * Both extensions are optional. When sqlite-vec is unavailable (CI without
 * the native module, unsupported platform), the repositories fall back to
 * in-memory cosine similarity and LIKE-based keyword search.
 */

import { createRequire } from 'node:module';

import type Database from 'better-sqlite3';

const _require = createRequire(import.meta.url);

interface SqliteVecModule {
  load(db: Database.Database): void;
  getLoadablePath(): string;
}

let _vec: SqliteVecModule | null = null;
try {
  _vec = _require('sqlite-vec') as SqliteVecModule;
} catch {
  // Package not installed or not supported on this platform.
}

/** Returns true when sqlite-vec loaded successfully. */
export function isVecLoaded(): boolean {
  return _vec !== null;
}

const VEC_DIM = 1024;

/**
 * Load the sqlite-vec extension into `db` and ensure all M4 virtual tables
 * exist:
 *
 *  - `knowledge_chunks_vec` — vec0 projection of `knowledge_chunks.embedding`
 *  - `semantic_memories_vec` — vec0 projection of `semantic_memories.embedding`
 *  - `knowledge_chunks_fts` — FTS5 projection of `knowledge_chunks.content`
 *
 * Safe to call multiple times — every CREATE uses `IF NOT EXISTS`. Returns
 * true when vec0 was loaded; FTS5 is built-in to SQLite so it always succeeds.
 */
export function loadKnowledgeExtensions(db: Database.Database): boolean {
  if (!_vec) return false;
  let vec0Ok = false;
  try {
    _vec.load(db);
    db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_chunks_vec USING vec0(
        chunk_id TEXT PRIMARY KEY,
        embedding FLOAT[${VEC_DIM}]
      );

      CREATE VIRTUAL TABLE IF NOT EXISTS semantic_memories_vec USING vec0(
        memory_id TEXT PRIMARY KEY,
        embedding FLOAT[${VEC_DIM}]
      );
    `);
    vec0Ok = true;
  } catch {
    // vec0 unavailable — repositories fall back to in-memory cosine similarity.
  }
  try {
    // FTS5 is built-in to SQLite; failure here is a genuine misconfiguration.
    db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_chunks_fts USING fts5(
        chunk_id UNINDEXED,
        content,
        tokenize = 'porter unicode61 remove_diacritics 1'
      );
    `);
  } catch (err) {
    console.warn('[vec-extension] FTS5 setup failed:', err instanceof Error ? err.message : String(err));
  }
  return vec0Ok;
}

/**
 * Back-compat alias for `loadKnowledgeExtensions`. Older code paths and
 * tests use this name when they only care about vec0 bootstrap.
 */
export function loadVecExtension(db: Database.Database): boolean {
  return loadKnowledgeExtensions(db);
}

/** Returns the embedding dimensionality the vec0 tables were sized for. */
export function vecDimension(): number {
  return VEC_DIM;
}
