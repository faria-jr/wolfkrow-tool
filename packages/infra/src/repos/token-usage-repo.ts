import { randomUUID } from 'crypto';

import { and, eq, gte, lte, desc } from 'drizzle-orm';

import { getDb } from '../db/client';
import { tokenUsage } from '../db/schema';

export type TokenUsageSource = typeof tokenUsage.$inferInsert['source'];

export interface TokenUsageRecord {
  id: string;
  userId: string;
  source: TokenUsageSource;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  cost: number; // USD cents
  sessionId: string | undefined;
  agentId: string | undefined;
  timestamp: Date;
}

export interface TokenUsageFilter {
  userId: string;
  from?: Date;
  to?: Date;
  source?: TokenUsageSource;
  agentId?: string;
}

export class DrizzleTokenUsageRepo {
  constructor(private readonly db = getDb()) {}

  insert(record: Omit<TokenUsageRecord, 'id'>): void {
    this.db
      .insert(tokenUsage)
      .values({
        id: randomUUID(),
        userId: record.userId,
        source: record.source,
        model: record.model,
        inputTokens: record.inputTokens,
        outputTokens: record.outputTokens,
        cacheReadTokens: record.cacheReadTokens,
        cacheWriteTokens: record.cacheWriteTokens,
        cost: record.cost,
        sessionId: record.sessionId ?? null,
        agentId: record.agentId ?? null,
        timestamp: record.timestamp,
      })
      .run();
  }

  findMany(filter: TokenUsageFilter): TokenUsageRecord[] {
    const conditions = [eq(tokenUsage.userId, filter.userId)];
    if (filter.from) conditions.push(gte(tokenUsage.timestamp, filter.from));
    if (filter.to) conditions.push(lte(tokenUsage.timestamp, filter.to));
    if (filter.source) conditions.push(eq(tokenUsage.source, filter.source));
    if (filter.agentId) conditions.push(eq(tokenUsage.agentId, filter.agentId));

    const rows = this.db
      .select()
      .from(tokenUsage)
      .where(and(...conditions))
      .orderBy(desc(tokenUsage.timestamp))
      .limit(1000)
      .all();

    return rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      source: r.source,
      model: r.model,
      inputTokens: r.inputTokens,
      outputTokens: r.outputTokens,
      cacheReadTokens: r.cacheReadTokens,
      cacheWriteTokens: r.cacheWriteTokens,
      cost: r.cost,
      sessionId: r.sessionId ?? undefined,
      agentId: r.agentId ?? undefined,
      timestamp: r.timestamp,
    }));
  }

  totalCostCents(filter: TokenUsageFilter): number {
    const records = this.findMany(filter);
    return records.reduce((sum, r) => sum + r.cost, 0);
  }
}
