/**
 * sqlite-vec extension loader.
 *
 * Attempts to load the vec0 virtual-table module into a better-sqlite3
 * Database and create the knowledge_chunks_vec shadow table (1024-dim,
 * matching Voyage-3 embedding size).  Gracefully no-ops when the native
 * extension is unavailable (CI, unsupported platform, etc.).
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

/**
 * Load the sqlite-vec extension into `db` and ensure the
 * `knowledge_chunks_vec` virtual table exists (1024 FLOAT dims).
 *
 * Safe to call multiple times — uses `CREATE VIRTUAL TABLE IF NOT EXISTS`.
 * Returns true on success, false when the extension is unavailable.
 */
export function loadVecExtension(db: Database.Database): boolean {
  if (!_vec) return false;
  try {
    _vec.load(db);
    db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_chunks_vec USING vec0(
        chunk_id TEXT PRIMARY KEY,
        embedding FLOAT[1024]
      )
    `);
    return true;
  } catch {
    return false;
  }
}
