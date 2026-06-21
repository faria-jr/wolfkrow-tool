/**
 * Database migration runner
 *
 * Reads SQL files from ./drizzle/ and applies them sequentially.
 */

import fs from 'node:fs';
import path from 'node:path';

import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

import { createLogger } from '../logger';

import { closeDb, getDb } from './client';

const logger = createLogger('db:migrate');

export interface MigrationOptions {
  migrationsFolder?: string;
  dbPath?: string;
}

export function runMigrations(options: MigrationOptions = {}): void {
  const folder = options.migrationsFolder ?? path.resolve(process.cwd(), 'drizzle');

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
  } finally {
    closeDb();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runMigrations();
}
