import { defaultPricingCalculator } from '@wolfkrow/domain';
import type { TokenUsage, UsageRepo } from '@wolfkrow/domain';

export type { UsageRepo, UsageRecord } from '@wolfkrow/domain';

// --- Record Usage ---

export interface RecordUsageInput {
  userId: string;
  source: string;
  model: string;
  usage: TokenUsage;
  sessionId?: string;
  agentId?: string;
}

export class RecordUsageUseCase {
  constructor(private readonly repo: UsageRepo) {}

  execute(input: RecordUsageInput): void {
    const cost = defaultPricingCalculator.cost(input.model, input.usage);
    this.repo.insert({
      userId: input.userId,
      source: input.source,
      model: input.model,
      inputTokens: input.usage.inputTokens,
      outputTokens: input.usage.outputTokens,
      cacheReadTokens: input.usage.cacheReadTokens ?? 0,
      cacheWriteTokens: input.usage.cacheWriteTokens ?? 0,
      cost: cost.usdCents,
      ...(input.sessionId !== undefined ? { sessionId: input.sessionId } : {}),
      ...(input.agentId !== undefined ? { agentId: input.agentId } : {}),
      timestamp: new Date(),
    });
  }
}

// --- Compute Usage ---

export interface ComputeUsageInput {
  userId: string;
  from?: Date;
  to?: Date;
  source?: string;
  agentId?: string;
}

export interface UsageSummary {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostUSD: number;
  byModel: Record<string, { inputTokens: number; outputTokens: number; costUSD: number }>;
  bySource: Record<string, { inputTokens: number; outputTokens: number; costUSD: number }>;
  byDay: Record<string, { inputTokens: number; outputTokens: number; costUSD: number }>;
}

export class ComputeUsageUseCase {
  constructor(private readonly repo: UsageRepo) {}

  execute(input: ComputeUsageInput): UsageSummary {
    const records = this.repo.findMany(input);

    const summary: UsageSummary = {
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCostUSD: 0,
      byModel: {},
      bySource: {},
      byDay: {},
    };

    for (const r of records) {
      summary.totalInputTokens += r.inputTokens;
      summary.totalOutputTokens += r.outputTokens;
      const costUSD = r.cost / 100;
      summary.totalCostUSD += costUSD;

      // byModel
      const model = (summary.byModel[r.model] ??= { inputTokens: 0, outputTokens: 0, costUSD: 0 });
      model.inputTokens += r.inputTokens;
      model.outputTokens += r.outputTokens;
      model.costUSD += costUSD;

      // bySource
      const src = (summary.bySource[r.source] ??= { inputTokens: 0, outputTokens: 0, costUSD: 0 });
      src.inputTokens += r.inputTokens;
      src.outputTokens += r.outputTokens;
      src.costUSD += costUSD;

      // byDay
      const day = r.timestamp.toISOString().slice(0, 10);
      const d = (summary.byDay[day] ??= { inputTokens: 0, outputTokens: 0, costUSD: 0 });
      d.inputTokens += r.inputTokens;
      d.outputTokens += r.outputTokens;
      d.costUSD += costUSD;
    }

    return summary;
  }
}

// --- Check Budget ---

export interface CheckBudgetInput {
  userId: string;
  budgetUSD: number;
  agentId?: string;
  periodDays?: number;
}

export interface CheckBudgetOutput {
  spentUSD: number;
  budgetUSD: number;
  percentUsed: number;
  exceeded: boolean;
}

export class CheckBudgetUseCase {
  constructor(private readonly repo: UsageRepo) {}

  execute(input: CheckBudgetInput): CheckBudgetOutput {
    const days = input.periodDays ?? 30;
    const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const totalCents = this.repo.totalCostCents({
      userId: input.userId,
      from,
      ...(input.agentId !== undefined ? { agentId: input.agentId } : {}),
    });
    const spentUSD = totalCents / 100;
    const percentUsed = input.budgetUSD > 0 ? (spentUSD / input.budgetUSD) * 100 : 0;
    return {
      spentUSD,
      budgetUSD: input.budgetUSD,
      percentUsed,
      exceeded: spentUSD > input.budgetUSD,
    };
  }
}
