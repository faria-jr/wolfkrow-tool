/**
 * Dreaming gate: triggers memory consolidation after idle period (>5 min).
 * Calls GenerateDailySummaryUseCase and logs compaction events.
 */
import type { DailySummaryRepo } from '@wolfkrow/domain';
import { GenerateDailySummaryUseCase } from '@wolfkrow/use-cases';

import type { Logger } from '../../logger';

export interface DreamingGateOptions {
  idleThresholdMs?: number;
  userId: string;
}

export class DreamingGate {
  private lastActivityAt = new Date();
  private timer: NodeJS.Timeout | null = null;
  private readonly idleThresholdMs: number;
  private readonly generateSummary: GenerateDailySummaryUseCase;

  constructor(
    summaryRepo: DailySummaryRepo,
    private readonly options: DreamingGateOptions,
    private readonly logger?: Logger,
  ) {
    this.idleThresholdMs = options.idleThresholdMs ?? 5 * 60 * 1000;
    this.generateSummary = new GenerateDailySummaryUseCase(summaryRepo);
  }

  recordActivity(): void {
    this.lastActivityAt = new Date();
    this.reschedule();
  }

  start(): void {
    this.reschedule();
  }

  stop(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private reschedule(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.onIdle(), this.idleThresholdMs);
  }

  private async onIdle(): Promise<void> {
    const idleMs = Date.now() - this.lastActivityAt.getTime();
    if (idleMs < this.idleThresholdMs) {
      this.reschedule();
      return;
    }

    this.logger?.info({ userId: this.options.userId }, 'Dreaming gate: idle threshold reached, consolidating');

    const today = new Date().toISOString().slice(0, 10);

    try {
      await this.generateSummary.execute({
        userId: this.options.userId,
        date: today,
        content: `Auto-generated daily summary for ${today}`,
        sessionCount: 1,
        messageCount: 0,
        tokensUsed: 0,
        cost: 0,
      });
      this.logger?.info({ userId: this.options.userId, date: today }, 'Dreaming gate: daily summary created');
    } catch (err) {
      this.logger?.info({ err }, 'Dreaming gate: summary creation failed (non-critical)');
    }
  }
}
