#!/usr/bin/env node
/**
 * D.1 — LionClaw v3.0 → Wolfkrow data migrator.
 *
 * Usage:
 *   npx tsx scripts/migrate-lionclaw.ts --from ~/.lionclaw/data.db
 *   npx tsx scripts/migrate-lionclaw.ts --from ~/.lionclaw/data.db --dry-run
 *   npx tsx scripts/migrate-lionclaw.ts --from ~/.lionclaw/data.db --tables users,agents
 *   npx tsx scripts/migrate-lionclaw.ts --rollback --to .wolfkrow/data/wolfkrow.db
 *
 * Safety:
 *  - Dry-run by default if --dry-run is passed (zero writes).
 *  - Creates a backup of the target DB before migrating.
 *  - Rollback restores the pre-migration backup.
 *  - Idempotent: rows with the same PK are skipped (INSERT OR IGNORE).
 */

import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

import Database from 'better-sqlite3';

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

const { values: args } = parseArgs({
  args: process.argv.slice(2),
  options: {
    from:     { type: 'string'  },
    to:       { type: 'string'  },
    'dry-run':{ type: 'boolean', default: false },
    rollback: { type: 'boolean', default: false },
    tables:   { type: 'string'  },
    verbose:  { type: 'boolean', default: false },
  },
  strict: false,
});

const DRY_RUN  = args['dry-run'] as boolean;
const ROLLBACK = args['rollback'] as boolean;
const VERBOSE  = args['verbose'] as boolean;
const FROM_PATH = args['from'] as string | undefined;
const TO_PATH  = (args['to'] as string | undefined) ?? process.env['WOLFKROW_DB_PATH'] ?? '.wolfkrow/data/wolfkrow.db';
const TABLES_FILTER = args['tables'] ? (args['tables'] as string).split(',').map((s) => s.trim()) : null;

// ---------------------------------------------------------------------------
// Report types
// ---------------------------------------------------------------------------

interface TableReport {
  table: string;
  source: string;
  total: number;
  migrated: number;
  skipped: number;
  errors: string[];
}

interface MigrationReport {
  dryRun: boolean;
  fromPath: string;
  toPath: string;
  tables: TableReport[];
  startedAt: Date;
  finishedAt: Date;
  totalMigrated: number;
  totalErrors: number;
}

// ---------------------------------------------------------------------------
// Table mapping: LionClaw table → Wolfkrow table + column remaps
// ---------------------------------------------------------------------------

interface ColumnMap {
  /** Wolfkrow column name → LionClaw column name. Omit to use same name. */
  [wolfkrowCol: string]: string;
}

interface TableMapping {
  /** LionClaw table name */
  src: string;
  /** Wolfkrow table name */
  dst: string;
  /** Column renames */
  columns?: ColumnMap;
  /** Columns to skip */
  skip?: string[];
  /** Default values for new required columns absent in LionClaw */
  defaults?: Record<string, unknown>;
}

const TABLE_MAPPINGS: TableMapping[] = [
  {
    src: 'users',
    dst: 'users',
    columns: { display_name: 'display_name' },
    defaults: { role: 'owner', totp_enabled: 0, failed_attempts: 0, metadata: '{}' },
  },
  {
    src: 'agents',
    dst: 'agents',
    defaults: {
      effort: 'medium',
      thinking: 0,
      max_turns: 80,
      allowed_tools: '[]',
      mcp_servers: '[]',
      is_active: 1,
      skills: '[]',
      runtime: 'cloud',
      metadata: '{}',
    },
  },
  {
    src: 'chat_sessions',
    dst: 'chat_sessions',
    columns: { last_activity: 'last_activity' },
    defaults: { archived: 0, metadata: '{}' },
  },
  {
    src: 'chat_messages',
    dst: 'chat_messages',
    defaults: {
      attachments: '[]',
      tool_calls: '[]',
      tool_results: '[]',
      metadata: '{}',
    },
  },
  {
    src: 'knowledge_documents',
    dst: 'knowledge_documents',
    defaults: { chunk_count: 0, metadata: '{}' },
  },
  {
    src: 'knowledge_chunks',
    dst: 'knowledge_chunks',
    defaults: { metadata: '{}' },
  },
  {
    src: 'memory',
    dst: 'semantic_memories',
    columns: { user_id: 'user_id', content: 'content' },
    defaults: { metadata: '{}' },
    skip: [],
  },
  {
    // Migrate only metadata (key/description/timestamps), NOT secret values
    // (values live in keytar, not the DB — no path to migrate them here).
    src: 'secrets',
    dst: 'vault_secrets',
    skip: ['value', 'encrypted_value'],
    defaults: { metadata: '{}' },
  },
  {
    src: 'mcp_servers',
    dst: 'mcp_servers',
    defaults: { is_enabled: 1, metadata: '{}' },
  },
  {
    src: 'scheduled_tasks',
    dst: 'scheduled_tasks',
    defaults: { is_active: 1, metadata: '{}' },
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function log(msg: string) { console.log(msg); }
function verbose(msg: string) { if (VERBOSE) console.log(`  [verbose] ${msg}`); }
function warn(msg: string)  { console.warn(`  ⚠️  ${msg}`); }
function error(msg: string) { console.error(`  ❌  ${msg}`); }

function backupPath(dbPath: string): string {
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  return `${dbPath}.backup-pre-migration-${ts}`;
}

function getColumns(db: Database.Database, table: string): Set<string> {
  try {
    const rows = db.prepare(`PRAGMA table_info("${table}")`).all() as Array<{ name: string }>;
    return new Set(rows.map((r) => r.name));
  } catch {
    return new Set();
  }
}

function tableExists(db: Database.Database, table: string): boolean {
  const row = db
    .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`)
    .get(table) as { name: string } | undefined;
  return !!row;
}

// ---------------------------------------------------------------------------
// Single-table migration
// ---------------------------------------------------------------------------

function migrateTable(
  src: Database.Database,
  dst: Database.Database,
  mapping: TableMapping,
  dryRun: boolean,
): TableReport {
  const report: TableReport = {
    table: mapping.dst,
    source: mapping.src,
    total: 0,
    migrated: 0,
    skipped: 0,
    errors: [],
  };

  if (!tableExists(src, mapping.src)) {
    warn(`Source table "${mapping.src}" not found — skipping.`);
    return report;
  }

  if (!tableExists(dst, mapping.dst)) {
    warn(`Destination table "${mapping.dst}" not found — skipping.`);
    return report;
  }

  const srcCols = getColumns(src, mapping.src);
  const dstCols = getColumns(dst, mapping.dst);
  const skipSet = new Set(mapping.skip ?? []);

  const rows = src.prepare(`SELECT * FROM "${mapping.src}"`).all() as Record<string, unknown>[];
  report.total = rows.length;

  if (rows.length === 0) {
    verbose(`${mapping.src}: 0 rows — nothing to migrate.`);
    return report;
  }

  // Build target column list
  const targetCols = Array.from(dstCols).filter((col) => !skipSet.has(col));

  const insertSql = `INSERT OR IGNORE INTO "${mapping.dst}" (${targetCols.map((c) => `"${c}"`).join(', ')})
    VALUES (${targetCols.map(() => '?').join(', ')})`;

  const stmt = dryRun ? null : dst.prepare(insertSql);

  for (const row of rows) {
    try {
      const values = targetCols.map((dstCol) => {
        // Check column remap
        const srcCol = mapping.columns?.[dstCol] ?? dstCol;
        // If source has it, use it
        if (srcCols.has(srcCol) && row[srcCol] !== undefined) return row[srcCol];
        // Otherwise use default
        const def = mapping.defaults?.[dstCol];
        if (def !== undefined) return def;
        return null;
      });

      if (dryRun) {
        verbose(`DRY-RUN: would insert ${mapping.dst} pk=${targetCols[0] ? String(values[0]) : '?'}`);
        report.migrated++;
      } else {
        const info = stmt!.run(...values) as Database.RunResult;
        if (info.changes > 0) {
          report.migrated++;
        } else {
          report.skipped++;
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      report.errors.push(msg);
      report.skipped++;
    }
  }

  return report;
}

// ---------------------------------------------------------------------------
// Rollback
// ---------------------------------------------------------------------------

function rollback(toPath: string) {
  const absTo = path.resolve(toPath);
  const backups = fs
    .readdirSync(path.dirname(absTo))
    .filter((f) => f.startsWith(path.basename(absTo) + '.backup-pre-migration-'))
    .sort()
    .reverse();

  if (backups.length === 0) {
    error('No backup found to restore.');
    process.exit(1);
  }

  const latest = path.join(path.dirname(absTo), backups[0]!);
  log(`Restoring backup: ${latest} → ${absTo}`);
  fs.copyFileSync(latest, absTo);
  log('Rollback complete.');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  if (ROLLBACK) {
    rollback(TO_PATH);
    return;
  }

  if (!FROM_PATH) {
    error('Missing --from <lionclaw-db-path>');
    process.exit(1);
  }

  const absFrom = path.resolve(FROM_PATH.replace(/^~/, process.env['HOME'] ?? '~'));
  const absTo   = path.resolve(TO_PATH);

  if (!fs.existsSync(absFrom)) {
    error(`LionClaw database not found: ${absFrom}`);
    process.exit(1);
  }

  log(`\n🦁 LionClaw → Wolfkrow data migrator`);
  log(`   From: ${absFrom}`);
  log(`   To  : ${absTo}`);
  log(`   Mode: ${DRY_RUN ? 'DRY RUN (no writes)' : 'LIVE'}\n`);

  // Backup before migration
  if (!DRY_RUN && fs.existsSync(absTo)) {
    const bkp = backupPath(absTo);
    fs.copyFileSync(absTo, bkp);
    log(`✅ Backup created: ${bkp}`);
  }

  const src = new Database(absFrom, { readonly: true });
  const dst = DRY_RUN ? new Database(':memory:') : new Database(absTo);

  if (!DRY_RUN) {
    dst.pragma('journal_mode = WAL');
    dst.pragma('foreign_keys = OFF'); // re-enable after migration
  }

  const mappings = TABLES_FILTER
    ? TABLE_MAPPINGS.filter((m) => TABLES_FILTER.includes(m.src) || TABLES_FILTER.includes(m.dst))
    : TABLE_MAPPINGS;

  const startedAt = new Date();
  const tableReports: TableReport[] = [];

  for (const mapping of mappings) {
    log(`  Migrating: ${mapping.src} → ${mapping.dst}`);
    const rep = migrateTable(src, dst, mapping, DRY_RUN);
    tableReports.push(rep);
    log(`    total=${rep.total} migrated=${rep.migrated} skipped=${rep.skipped} errors=${rep.errors.length}`);
    if (rep.errors.length > 0 && VERBOSE) {
      for (const e of rep.errors.slice(0, 5)) warn(e);
    }
  }

  if (!DRY_RUN) {
    dst.pragma('foreign_keys = ON');
  }

  src.close();
  if (!DRY_RUN) dst.close();

  const finishedAt = new Date();
  const totalMigrated = tableReports.reduce((s, r) => s + r.migrated, 0);
  const totalErrors   = tableReports.reduce((s, r) => s + r.errors.length, 0);

  const report: MigrationReport = {
    dryRun: DRY_RUN,
    fromPath: absFrom,
    toPath: absTo,
    tables: tableReports,
    startedAt,
    finishedAt,
    totalMigrated,
    totalErrors,
  };

  const reportPath = path.join(
    path.dirname(absTo),
    `migration-report-${finishedAt.toISOString().replace(/[:.]/g, '-')}.json`,
  );

  if (!DRY_RUN) {
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');
    log(`\n📊 Report saved: ${reportPath}`);
  }

  log(`\n✅ Migration ${DRY_RUN ? '(dry-run) ' : ''}complete:`);
  log(`   Total migrated : ${totalMigrated}`);
  log(`   Total errors   : ${totalErrors}`);
  log(`   Duration       : ${finishedAt.getTime() - startedAt.getTime()}ms`);

  if (totalErrors > 0) {
    warn('Some rows had errors. Run with --verbose to see details.');
    process.exit(1);
  }
}

main().catch((e) => {
  error(e instanceof Error ? e.message : String(e));
  process.exit(1);
});
