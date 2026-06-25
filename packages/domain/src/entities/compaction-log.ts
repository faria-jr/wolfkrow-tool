import { randomUUID } from 'node:crypto';

export type CompactionTrigger = 'manual' | 'token_threshold' | 'time_based' | 'idle';

export interface CompactionLogProps {
  id: string;
  userId: string;
  sessionId: string | null;
  trigger: CompactionTrigger;
  beforeTokens: number;
  afterTokens: number;
  tokensSaved: number;
  summary: string | null;
  createdAt: Date;
}

export type CompactionLogCreateInput = Omit<CompactionLogProps, 'id' | 'createdAt'>;

/**
 * Audit row for a memory-compaction / dreaming event. Persisted so the UI can
 * show dreaming history (FE-3). `trigger` distinguishes automatic idle runs
 * from manual "Dream now" presses.
 */
export class CompactionLog {
  readonly id: string;
  readonly userId: string;
  readonly sessionId: string | null;
  readonly trigger: CompactionTrigger;
  readonly beforeTokens: number;
  readonly afterTokens: number;
  readonly tokensSaved: number;
  readonly summary: string | null;
  readonly createdAt: Date;

  private constructor(props: CompactionLogProps) {
    this.id = props.id;
    this.userId = props.userId;
    this.sessionId = props.sessionId;
    this.trigger = props.trigger;
    this.beforeTokens = props.beforeTokens;
    this.afterTokens = props.afterTokens;
    this.tokensSaved = props.tokensSaved;
    this.summary = props.summary;
    this.createdAt = props.createdAt;
  }

  static create(input: CompactionLogCreateInput): CompactionLog {
    return new CompactionLog({ ...input, id: randomUUID(), createdAt: new Date() });
  }

  static fromProps(props: CompactionLogProps): CompactionLog {
    return new CompactionLog(props);
  }

  toProps(): CompactionLogProps {
    return {
      id: this.id,
      userId: this.userId,
      sessionId: this.sessionId,
      trigger: this.trigger,
      beforeTokens: this.beforeTokens,
      afterTokens: this.afterTokens,
      tokensSaved: this.tokensSaved,
      summary: this.summary,
      createdAt: this.createdAt,
    };
  }
}
