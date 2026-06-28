import type { CompactionLog } from '../entities/compaction-log';
import type { DailySummary } from '../entities/daily-summary';
import type { SemanticMemory } from '../entities/semantic-memory';

export interface MemorySearchResult {
  memory: SemanticMemory;
  distance: number;
}

/**
 * M4 — Reciprocal Rank Fusion of memory results across multiple search
 * strategies. `score` is the RRF sum; per-strategy ranks/distance are
 * undefined when the strategy did not contribute.
 */
export interface HybridMemorySearchResult {
  memory: SemanticMemory;
  score: number;
  vectorDistance?: number;
}

export interface SemanticMemoryRepo {
  findById(id: string): Promise<SemanticMemory | null>;
  findByUserId(userId: string, limit?: number): Promise<SemanticMemory[]>;
  save(memory: SemanticMemory): Promise<SemanticMemory>;
  delete(id: string): Promise<void>;
  deleteByUserId(userId: string): Promise<void>;
  vectorSearch(embedding: number[], userId: string, limit: number): Promise<MemorySearchResult[]>;
  /**
   * M4 — Fused vector search across user's memories. Defaults to vec0 when
   * available; falls back to JS cosine. `userId` filters to a single user.
   */
  hybridSearch(
    embedding: number[],
    userId: string,
    limit: number
  ): Promise<HybridMemorySearchResult[]>;
}

export interface DailySummaryRepo {
  findByUserIdAndDate(userId: string, date: string): Promise<DailySummary | null>;
  findByUserId(userId: string, limit?: number): Promise<DailySummary[]>;
  save(summary: DailySummary): Promise<DailySummary>;
}

export interface CompactionLogRepo {
  findByUserId(userId: string, limit?: number): Promise<CompactionLog[]>;
  save(log: CompactionLog): Promise<CompactionLog>;
}
