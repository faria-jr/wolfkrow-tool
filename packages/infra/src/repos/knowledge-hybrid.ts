import type {
  ChunkSearchResult,
  HybridChunkSearchResult,
  KeywordSearchResult,
} from '@wolfkrow/domain';
import type { KnowledgeChunk } from '@wolfkrow/domain';
import { inArray } from 'drizzle-orm';

import type { DatabaseClient } from '../db/client';
import { knowledgeChunks } from '../db/schema/knowledge';

import { hasTable, reciprocalRankFusion, type RankedItem } from './knowledge-helpers';

/**
 * M4 — vec0-backed vector search. Pulls the top `limit * 10` (or `limit` if
 * no document filter) candidates by cosine distance from the shadow table,
 * then hydrates each by primary-key lookup and applies the document filter.
 *
 * Pure function — receives `db` and a `toEntity` mapper so it doesn't have
 * a circular dependency with `knowledge-chunk-repo`.
 */
export function vectorSearchVec0(
  db: DatabaseClient,
  options: {
    embedding: number[];
    limit: number;
    documentIds: string[] | undefined;
    toEntity: (row: typeof knowledgeChunks.$inferSelect) => KnowledgeChunk;
  }
): ChunkSearchResult[] {
  const { embedding, limit, documentIds, toEntity } = options;
  const queryLimit = documentIds && documentIds.length > 0 ? limit * 10 : limit;
  const candidates = db.$client
    .prepare(
      `SELECT chunk_id, distance
       FROM knowledge_chunks_vec
       WHERE embedding MATCH ?
       ORDER BY distance
       LIMIT ?`
    )
    .all(JSON.stringify(embedding), queryLimit) as Array<{ chunk_id: string; distance: number }>;

  if (candidates.length === 0) return [];

  // Batch-fetch all candidates in a single IN query — avoids N individual lookups.
  const ids = candidates.map((c) => c.chunk_id);
  const rows = db.select().from(knowledgeChunks).where(inArray(knowledgeChunks.id, ids)).all();
  const rowMap = new Map(rows.map((r) => [r.id, r]));

  const results: ChunkSearchResult[] = [];
  for (const { chunk_id, distance } of candidates) {
    if (results.length >= limit) break;
    const row = rowMap.get(chunk_id);
    if (!row) continue;
    if (documentIds && documentIds.length > 0 && !documentIds.includes(row.documentId)) continue;
    results.push({ chunk: toEntity(row), distance });
  }
  return results;
}

/**
 * M4 — FTS5-backed keyword search. Converts the user query into a Porter
 * prefix query (e.g. "wolf bot" → "wolf* bot*") and orders by BM25 score.
 */
export function keywordSearchFts5(
  db: DatabaseClient,
  options: {
    query: string;
    limit: number;
    documentIds: string[] | undefined;
    toEntity: (row: typeof knowledgeChunks.$inferSelect) => KnowledgeChunk;
  }
): KeywordSearchResult[] {
  const { query, limit, documentIds, toEntity } = options;
  const ftsQuery = buildFtsQuery(query);
  if (!ftsQuery) return [];

  const fetchLimit = documentIds && documentIds.length > 0 ? limit * 10 : limit;
  const rows = db.$client
    .prepare(
      `SELECT chunk_id, bm25(knowledge_chunks_fts) AS rank
       FROM knowledge_chunks_fts
       WHERE knowledge_chunks_fts MATCH ?
       ORDER BY rank
       LIMIT ?`
    )
    .all(ftsQuery, fetchLimit) as Array<{ chunk_id: string; rank: number }>;

  if (rows.length === 0) return [];

  // Batch-fetch all candidates in a single IN query — avoids N individual lookups.
  const ids = rows.map((r) => r.chunk_id);
  const chunkRows = db.select().from(knowledgeChunks).where(inArray(knowledgeChunks.id, ids)).all();
  const rowMap = new Map(chunkRows.map((r) => [r.id, r]));

  return collectFtsResults({ rows, rowMap, documentIds, limit, toEntity });
}

interface CollectFtsOptions {
  rows: Array<{ chunk_id: string; rank: number }>;
  rowMap: Map<string, typeof knowledgeChunks.$inferSelect>;
  documentIds: string[] | undefined;
  limit: number;
  toEntity: (row: typeof knowledgeChunks.$inferSelect) => KnowledgeChunk;
}

function collectFtsResults(opts: CollectFtsOptions): KeywordSearchResult[] {
  const { rows, rowMap, documentIds, limit, toEntity } = opts;
  const results: KeywordSearchResult[] = [];
  for (const { chunk_id, rank } of rows) {
    if (results.length >= limit) break;
    const row = rowMap.get(chunk_id);
    if (!row) continue;
    if (documentIds && documentIds.length > 0 && !documentIds.includes(row.documentId)) continue;
    results.push({ chunk: toEntity(row), rank });
  }
  return results;
}

function buildFtsQuery(query: string): string {
  const cleaned = query
    .split(/\s+/)
    .map((term) => term.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter(Boolean);
  return cleaned.map((term) => `${term}*`).join(' ');
}

/**
 * M4 — Reciprocal Rank Fusion over vector + keyword results. Both lists
 * are normalized to ranks (1-based → 0-based), fused with k=60, and the
 * top `limit` by fused score are returned. `vecResults` and `kwResults`
 * are the raw outputs from the per-strategy searches.
 */
export function fuseHybridResults(
  vecResults: ChunkSearchResult[],
  kwResults: KeywordSearchResult[],
  limit: number
): HybridChunkSearchResult[] {
  const vecRanks: RankedItem[] = vecResults.map((r, idx) => ({
    id: r.chunk.toProps().id,
    rank: idx,
  }));
  const kwRanks: RankedItem[] = kwResults.map((r, idx) => ({
    id: r.chunk.toProps().id,
    rank: idx,
  }));
  const fused = reciprocalRankFusion([vecRanks, kwRanks]);
  const vecById = new Map<string, ChunkSearchResult>(
    vecResults.map((r) => [r.chunk.toProps().id, r])
  );
  const kwById = new Map<string, KeywordSearchResult>(
    kwResults.map((r) => [r.chunk.toProps().id, r])
  );

  return Array.from(fused.entries())
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit)
    .map(([id, score]) => toHybridResult(id, score, vecById, kwById));
}

function toHybridResult(
  id: string,
  score: number,
  vecById: Map<string, ChunkSearchResult>,
  kwById: Map<string, KeywordSearchResult>
): HybridChunkSearchResult {
  const vec = vecById.get(id);
  if (vec) {
    const result: HybridChunkSearchResult = {
      chunk: vec.chunk,
      score,
      vectorDistance: vec.distance,
    };
    const kw = kwById.get(id);
    if (kw) result.keywordRank = kw.rank;
    return result;
  }
  const kw = kwById.get(id);
  if (!kw) throw new Error(`hybridSearch: missing chunk for fused id ${id}`);
  return { chunk: kw.chunk, score, keywordRank: kw.rank };
}

export function isVec0Available(sqlite: DatabaseClient['$client']): boolean {
  return hasTable(sqlite, 'knowledge_chunks_vec');
}

export function isFtsAvailable(sqlite: DatabaseClient['$client']): boolean {
  return hasTable(sqlite, 'knowledge_chunks_fts');
}
