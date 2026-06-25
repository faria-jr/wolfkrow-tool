/**
 * Database migration runner
 *
 * Reads SQL files from ./drizzle/ and applies them sequentially.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

import { createLogger } from '../logger';

import { closeDb, getDb } from './client';

const logger = createLogger('db:migrate');

/**
 * Migrations live in the infra package root (packages/infra/drizzle), so
 * resolve relative to this module — not process.cwd(). Keeps the worker
 * boot (cwd=apps/worker) and the db:migrate CLI (cwd=packages/infra) both
 * pointing at the same folder.
 */
const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_MIGRATIONS_FOLDER = path.resolve(MODULE_DIR, '../../drizzle');

export interface MigrationOptions {
  migrationsFolder?: string;
  dbPath?: string;
}

export function runMigrations(options: MigrationOptions = {}): void {
  const folder = options.migrationsFolder ?? DEFAULT_MIGRATIONS_FOLDER;

  if (!fs.existsSync(folder)) {
    throw new Error(
      `Migrations folder not found: ${folder}\n` +
        `Run "pnpm db:generate" first to create migration files.`
    );
  }

  const db = getDb(options.dbPath);

  logger.info(`Running migrations from ${folder}...`);

  try {
    migrate(db as Parameters<typeof migrate>[0], { migrationsFolder: folder });
    logger.info('Migrations applied successfully');
  } catch (error) {
    logger.error({ err: error }, 'Migration failed');
    throw error;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runMigrations();
  closeDb();
}
