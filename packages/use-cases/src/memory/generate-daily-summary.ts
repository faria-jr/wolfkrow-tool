import type { DailySummaryRepo } from '@wolfkrow/domain';
import { DailySummary } from '@wolfkrow/domain';

export interface GenerateDailySummaryInput {
  userId: string;
  date: string;
  content: string;
  sessionCount: number;
  messageCount: number;
  tokensUsed: number;
  cost: number;
  metadata?: Record<string, unknown>;
}

export interface GenerateDailySummaryOutput {
  summary: DailySummary;
}

export class GenerateDailySummaryUseCase {
  constructor(private readonly repo: DailySummaryRepo) {}

  async execute(input: GenerateDailySummaryInput): Promise<GenerateDailySummaryOutput> {
    const summary = DailySummary.create({
      userId: input.userId,
      date: input.date,
      content: input.content,
      sessionCount: input.sessionCount,
      messageCount: input.messageCount,
      tokensUsed: input.tokensUsed,
      cost: input.cost,
      metadata: input.metadata ?? {},
    });
    const saved = await this.repo.save(summary);
    return { summary: saved };
  }
}
