import { defaultPricingCalculator } from '@wolfkrow/domain';
import type { TokenUsage, UsageRepo } from '@wolfkrow/domain';
import type { UsageSummary } from '@wolfkrow/shared-types';

export type { UsageRepo, UsageRecord } from '@wolfkrow/domain';
export type { UsageSummary } from '@wolfkrow/shared-types';

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

export class ComputeUsageUseCase {
  constructor(private readonly repo: UsageRepo) {}

  execute(input: ComputeUsageInput): UsageSummary {
    const records = this.repo.findMany(input);

    // Aggregate cost in integer cents per bucket and convert to USD once at the
    // end. Summing floats (convert-then-sum) accumulates rounding error across
    // many records; sum-integers-convert-last keeps the monetary value exact.
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalCostCents = 0;
    const byModel: Record<string, { inputTokens: number; outputTokens: number; costCents: number }> = {};
    const bySource: Record<string, { inputTokens: number; outputTokens: number; costCents: number }> = {};
    const byDayMap: Record<string, { inputTokens: number; outputTokens: number; costCents: number }> = {};

    for (const r of records) {
      totalInputTokens += r.inputTokens;
      totalOutputTokens += r.outputTokens;
      totalCostCents += r.cost;

      const model = (byModel[r.model] ??= { inputTokens: 0, outputTokens: 0, costCents: 0 });
      model.inputTokens += r.inputTokens;
      model.outputTokens += r.outputTokens;
      model.costCents += r.cost;

      const src = (bySource[r.source] ??= { inputTokens: 0, outputTokens: 0, costCents: 0 });
      src.inputTokens += r.inputTokens;
      src.outputTokens += r.outputTokens;
      src.costCents += r.cost;

      const day = r.timestamp.toISOString().slice(0, 10);
      const d = (byDayMap[day] ??= { inputTokens: 0, outputTokens: 0, costCents: 0 });
      d.inputTokens += r.inputTokens;
      d.outputTokens += r.outputTokens;
      d.costCents += r.cost;
    }

    const totalCostUSD = totalCostCents / 100;
    const byModelUSD = Object.fromEntries(
      Object.entries(byModel).map(([k, v]) => [k, {
        inputTokens: v.inputTokens,
        outputTokens: v.outputTokens,
        costUSD: v.costCents / 100,
      }]),
    );
    const bySourceUSD = Object.fromEntries(
      Object.entries(bySource).map(([k, v]) => [k, {
        inputTokens: v.inputTokens,
        outputTokens: v.outputTokens,
        costUSD: v.costCents / 100,
      }]),
    );
    const byDay = Object.entries(byDayMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, d]) => ({
        day,
        inputTokens: d.inputTokens,
        outputTokens: d.outputTokens,
        costUSD: d.costCents / 100,
      }));

    return { totalInputTokens, totalOutputTokens, totalCostUSD, byModel: byModelUSD, bySource: bySourceUSD, byDay };
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
