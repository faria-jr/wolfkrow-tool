/**
 * Port de repositório de usage (FIX-027).
 *
 * Antes o contrato `UsageRepo` vivia em `@wolfkrow/use-cases` e a infra
 * (`DrizzleTokenUsageRepo`) não o implementava formalmente — a rota fazia
 * `new DrizzleTokenUsageRepo() as never` para silenciar o tipo. Movido para o
 * domínio: fonte canônica do contrato, sem vazar enums do Drizzle (`source`
 * é `string` na fronteira; a infra impõe o enum da coluna na escrita).
 */

export interface UsageRecord {
  id: string;
  userId: string;
  source: string;
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

export interface UsageRecordInput {
  userId: string;
  source: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  cost: number; // USD cents
  sessionId?: string;
  agentId?: string;
  timestamp: Date;
}

export interface UsageFilter {
  userId: string;
  from?: Date;
  to?: Date;
  source?: string;
  agentId?: string;
}

export interface UsageCostFilter {
  userId: string;
  from?: Date;
  to?: Date;
  agentId?: string;
}

export interface UsageRepo {
  insert(record: UsageRecordInput): void;
  findMany(filter: UsageFilter): UsageRecord[];
  totalCostCents(filter: UsageCostFilter): number;
}
