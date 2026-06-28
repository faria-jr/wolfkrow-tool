/**
 * Dreaming gate: triggers memory consolidation after idle period (>5 min).
 * Calls GenerateDailySummaryUseCase and logs each run to the compaction log.
 */
import type { CompactionLogRepo, CompactionTrigger, DailySummaryRepo } from '@wolfkrow/domain';
import { GenerateDailySummaryUseCase, LogCompactionUseCase } from '@wolfkrow/use-cases';

import type { Logger } from '../../logger';

export interface DreamingGateOptions {
  idleThresholdMs?: number;
  userId: string;
}

export interface DreamingStatus {
  active: boolean;
  lastActivityAt: Date;
  idleThresholdMs: number;
}

export class DreamingGate {
  private lastActivityAt = new Date();
  private timer: NodeJS.Timeout | null = null;
  private readonly idleThresholdMs: number;
  private readonly generateSummary: GenerateDailySummaryUseCase;
  private readonly logCompaction: LogCompactionUseCase;

  constructor(
    summaryRepo: DailySummaryRepo,
    compactionLogRepo: CompactionLogRepo,
    private readonly options: DreamingGateOptions,
    private readonly logger?: Logger
  ) {
    this.idleThresholdMs = options.idleThresholdMs ?? 5 * 60 * 1000;
    this.generateSummary = new GenerateDailySummaryUseCase(summaryRepo);
    this.logCompaction = new LogCompactionUseCase(compactionLogRepo);
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

  getStatus(): DreamingStatus {
    return {
      active: this.timer !== null,
      lastActivityAt: this.lastActivityAt,
      idleThresholdMs: this.idleThresholdMs,
    };
  }

  /** Force a consolidation run immediately (manual "Dream now"). */
  async triggerNow(): Promise<void> {
    await this.consolidate('manual');
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

    this.logger?.info(
      { userId: this.options.userId },
      'Dreaming gate: idle threshold reached, consolidating'
    );
    await this.consolidate('idle');
  }

  private async consolidate(trigger: CompactionTrigger): Promise<void> {
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
      await this.logCompaction.execute({
        userId: this.options.userId,
        trigger,
        beforeTokens: 0,
        afterTokens: 0,
        tokensSaved: 0,
        summary: `Daily summary for ${today}`,
      });
      this.logger?.info(
        { userId: this.options.userId, trigger, date: today },
        'Dreaming gate: consolidation complete'
      );
    } catch (err) {
      this.logger?.info({ err }, 'Dreaming gate: consolidation failed (non-critical)');
    }
  }
}
