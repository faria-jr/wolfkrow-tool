/**
 * Drizzle SQLite client
 *
 * Single source of truth for DB connection.
 * Singleton pattern: one client per process.
 */

import fs from 'node:fs';
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

const DEFAULT_DB_PATH = '.wolfkrow/data/wolfkrow.db';

/**
 * Get or create SQLite database instance (singleton)
 */
export function getSqlite(dbPath?: string): Database.Database {
  if (_sqlite) return _sqlite;

  const pathToUse = dbPath ?? process.env.WOLFKROW_DB_PATH ?? DEFAULT_DB_PATH;
  const absolutePath = path.resolve(pathToUse);

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

  const pathToUse = dbPath ?? process.env.WOLFKROW_DB_PATH ?? DEFAULT_DB_PATH;
  const absolutePath = path.resolve(pathToUse);

  if (fs.existsSync(absolutePath)) {
    fs.unlinkSync(absolutePath);
  }
  const walPath = `${absolutePath}-wal`;
  const shmPath = `${absolutePath}-shm`;
  if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
  if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);
}

export { schema };
