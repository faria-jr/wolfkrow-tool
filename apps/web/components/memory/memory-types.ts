/**
 * Shared types for the memory view components. Extracted so the main
 * component file stays under the linter's max-lines cap.
 */

export interface MemoryData {
  id: string;
  content: string;
  source: string;
  importance: number;
  accessCount: number;
  createdAt: string;
}

export interface MemorySearchResult {
  memory: MemoryData;
  distance: number;
}

export interface DailySummaryData {
  id: string;
  userId: string;
  date: string;
  content: string;
  sessionCount: number;
  messageCount: number;
  tokensUsed: number;
  cost: number;
  createdAt: string;
}

export type MemoryTabKey = 'list' | 'search' | 'summaries';
