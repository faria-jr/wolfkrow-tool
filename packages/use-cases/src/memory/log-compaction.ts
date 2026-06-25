import type { CompactionLogRepo } from '@wolfkrow/domain';
import type { CompactionTrigger } from '@wolfkrow/domain';
import { CompactionLog } from '@wolfkrow/domain';

export interface LogCompactionInput {
  userId: string;
  trigger: CompactionTrigger;
  sessionId?: string;
  beforeTokens: number;
  afterTokens: number;
  tokensSaved: number;
  summary?: string;
}

export interface LogCompactionOutput {
  log: CompactionLog;
}

/**
 * Records a dreaming/compaction event to the audit log so the UI can render
 * dreaming history (FE-3). Called by the DreamingGate on idle runs and by the
 * manual "Dream now" trigger.
 */
export class LogCompactionUseCase {
  constructor(private readonly repo: CompactionLogRepo) {}

  async execute(input: LogCompactionInput): Promise<LogCompactionOutput> {
    const log = CompactionLog.create({
      userId: input.userId,
      trigger: input.trigger,
      sessionId: input.sessionId ?? null,
      beforeTokens: input.beforeTokens,
      afterTokens: input.afterTokens,
      tokensSaved: input.tokensSaved,
      summary: input.summary ?? null,
    });
    const saved = await this.repo.save(log);
    return { log: saved };
  }
}
