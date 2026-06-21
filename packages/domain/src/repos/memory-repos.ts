import type { SemanticMemory } from '../entities/semantic-memory';
import type { DailySummary } from '../entities/daily-summary';

export interface MemorySearchResult {
  memory: SemanticMemory;
  distance: number;
}

export interface SemanticMemoryRepo {
  findById(id: string): Promise<SemanticMemory | null>;
  findByUserId(userId: string, limit?: number): Promise<SemanticMemory[]>;
  save(memory: SemanticMemory): Promise<SemanticMemory>;
  delete(id: string): Promise<void>;
  deleteByUserId(userId: string): Promise<void>;
  vectorSearch(embedding: number[], userId: string, limit: number): Promise<MemorySearchResult[]>;
}

export interface DailySummaryRepo {
  findByUserIdAndDate(userId: string, date: string): Promise<DailySummary | null>;
  findByUserId(userId: string, limit?: number): Promise<DailySummary[]>;
  save(summary: DailySummary): Promise<DailySummary>;
}
