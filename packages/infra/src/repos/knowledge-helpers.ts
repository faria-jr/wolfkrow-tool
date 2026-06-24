import type Database from 'better-sqlite3';

import type { DatabaseClient } from '../db/client';

export const VEC_DIM = 1024;
export const RRF_K = 60;

export interface RankedItem {
  id: string;
  rank: number;
}

/**
 * M4 — Returns true when `name` exists as a virtual or ordinary table.
 * Used to gate vec0 + FTS5 code paths so they degrade gracefully on
 * databases where the extensions are missing.
 */
export function hasTable(sqlite: DatabaseClient['$client'], name: string): boolean {
  return (
    sqlite
      .prepare(`SELECT 1 FROM sqlite_master WHERE type='table' AND name=?`)
      .get(name) != null
  );
}

/**
 * M4 — Reciprocal Rank Fusion (RRF) with constant k=60 (the value used in
 * the original Cormack/Clarke/Buettcher paper). Sum of `1/(k + rank + 1)`
 * across each ranking list; the fused score ranks monotonically decreasing
 * by relevance. Pure function — no DB or I/O.
 */
export function reciprocalRankFusion(ranksLists: RankedItem[][]): Map<string, number> {
  const scores = new Map<string, number>();
  for (const list of ranksLists) {
    list.forEach((entry, idx) => {
      const rrf = 1 / (RRF_K + idx + 1);
      scores.set(entry.id, (scores.get(entry.id) ?? 0) + rrf);
    });
  }
  return scores;
}

/**
 * Try to call `fn`, swallowing vec0-specific errors (extension not loaded,
 * dimension mismatch, etc.). Used so a vec0 outage never fails the canonical
 * Drizzle insert — JS cosine fallback can still service `vectorSearch`.
 */
export function swallowVecError(fn: () => void): void {
  try {
    fn();
  } catch {
    /* vec0 insert failure is non-fatal */
  }
}

export type SqliteStatement = Database.Statement<unknown[], unknown>;
