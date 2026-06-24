import { randomUUID } from 'crypto';

import type {
 UsageCostFilter,
 UsageFilter,
 UsageRecord,
 UsageRecordInput,
 UsageRepo,
} from '@wolfkrow/domain';
import { and, desc, eq, gte, lte } from 'drizzle-orm';

import { getDb } from '../db/client';
import { tokenUsage } from '../db/schema';

/**
 * Drizzle enum da coluna `source` : a fronteira do domínio trata
 * `source` como `string`; a infra restringe ao enum real da coluna na escrita.
 * Tipo interno — não exportado como contrato público.
 */
type TokenUsageSource = typeof tokenUsage.$inferInsert['source'];

/**
 * Token-usage repository via Drizzle (SQLite). Implementa o port `UsageRepo`
 * do domínio (antes o contrato vivia em use-cases e esta classe não
 * o implementava formalmente — a rota fazia `as never`).
 */
export class DrizzleTokenUsageRepo implements UsageRepo {
 constructor(private readonly db = getDb()) {}

 insert(record: UsageRecordInput): void {
 this.db
 .insert(tokenUsage)
 .values({
 id: randomUUID(),
 userId: record.userId,
 source: record.source as TokenUsageSource,
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

 findMany(filter: UsageFilter): UsageRecord[] {
 const conditions = [eq(tokenUsage.userId, filter.userId)];
 if (filter.from) conditions.push(gte(tokenUsage.timestamp, filter.from));
 if (filter.to) conditions.push(lte(tokenUsage.timestamp, filter.to));
 if (filter.source) conditions.push(eq(tokenUsage.source, filter.source as TokenUsageSource));
 if (filter.agentId) conditions.push(eq(tokenUsage.agentId, filter.agentId));

 const rows = this.db
 .select()
 .from(tokenUsage)
 .where(and(...conditions))
 .orderBy(desc(tokenUsage.timestamp))
 .limit(1000)
 .all();

 return rows.map(this.toRecord);
 }

 totalCostCents(filter: UsageCostFilter): number {
 const conditions = [eq(tokenUsage.userId, filter.userId)];
 if (filter.from) conditions.push(gte(tokenUsage.timestamp, filter.from));
 if (filter.to) conditions.push(lte(tokenUsage.timestamp, filter.to));
 if (filter.agentId) conditions.push(eq(tokenUsage.agentId, filter.agentId));

 const rows = this.db
 .select({ cost: tokenUsage.cost })
 .from(tokenUsage)
 .where(and(...conditions))
 .all();

 return rows.reduce((sum, r) => sum + r.cost, 0);
 }

 private toRecord = (r: typeof tokenUsage.$inferSelect): UsageRecord => ({
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
 });
}
