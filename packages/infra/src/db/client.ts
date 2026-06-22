/**
 * Drizzle SQLite client
 *
 * Single source of truth for DB connection.
 * Singleton pattern: one client per process.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { getLoadablePath } from 'sqlite-vec';

import * as schema from './schema/index';

export type DatabaseClient = BetterSQLite3Database<typeof schema> & {
  $client: Database.Database;
};

let _client: DatabaseClient | null = null;
let _sqlite: Database.Database | null = null;

/**
 * Resolve the SQLite database path deterministically, independent of the
 * process cwd (FIX-001: previously '.wolfkrow/...' was joined to cwd, so web,
 * worker and migrate each opened a DIFFERENT file → split-brain DBs).
 *
 * Precedence: explicit arg → WOLFKROW_DB_PATH env → $HOME/.wolfkrow/data/wolfkrow.db.
 */
export function resolveDbPath(explicit?: string): string {
  if (explicit) return path.resolve(explicit);
  const envPath = process.env.WOLFKROW_DB_PATH;
  if (envPath) return path.resolve(envPath);
  return path.join(os.homedir(), '.wolfkrow', 'data', 'wolfkrow.db');
}

/**
 * Get or create SQLite database instance (singleton)
 */
export function getSqlite(dbPath?: string): Database.Database {
  if (_sqlite) return _sqlite;

  const absolutePath = resolveDbPath(dbPath);

  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });

  const sqlite = new Database(absolutePath);

  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  sqlite.pragma('busy_timeout = 5000');

  try {
    sqlite.loadExtension(getLoadablePath());
  } catch (error) {
    console.warn('sqlite-vec extension not available:', error);
  }

  _sqlite = sqlite;
  return sqlite;
}

/**
 * Get or create Drizzle ORM client (singleton)
 */
export function getDb(dbPath?: string): DatabaseClient {
  if (_client) return _client;

  const sqlite = getSqlite(dbPath);
  const db = drizzle(sqlite, { schema, logger: process.env.NODE_ENV === 'development' });

  _client = db as DatabaseClient;
  return _client;
}

/**
 * Close database connection (for graceful shutdown)
 */
export function closeDb(): void {
  if (_sqlite) {
    _sqlite.close();
    _sqlite = null;
    _client = null;
  }
}

/**
 * Reset database (drop all tables — DESTRUCTIVE)
 */
export function resetDb(dbPath?: string): void {
  closeDb();

  const absolutePath = resolveDbPath(dbPath);

  if (fs.existsSync(absolutePath)) {
    fs.unlinkSync(absolutePath);
  }
  const walPath = `${absolutePath}-wal`;
  const shmPath = `${absolutePath}-shm`;
  if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
  if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);
}

export { schema };
