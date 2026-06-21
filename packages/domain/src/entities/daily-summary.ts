import { randomUUID } from 'node:crypto';

export interface DailySummaryProps {
  id: string;
  userId: string;
  date: string;
  content: string;
  sessionCount: number;
  messageCount: number;
  tokensUsed: number;
  cost: number;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export type DailySummaryCreateInput = Omit<DailySummaryProps, 'id' | 'createdAt'>;

export class DailySummary {
  readonly id: string;
  readonly userId: string;
  readonly date: string;
  readonly content: string;
  readonly sessionCount: number;
  readonly messageCount: number;
  readonly tokensUsed: number;
  readonly cost: number;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: Date;

  private constructor(props: DailySummaryProps) {
    this.id = props.id;
    this.userId = props.userId;
    this.date = props.date;
    this.content = props.content;
    this.sessionCount = props.sessionCount;
    this.messageCount = props.messageCount;
    this.tokensUsed = props.tokensUsed;
    this.cost = props.cost;
    this.metadata = props.metadata;
    this.createdAt = props.createdAt;
  }

  static create(input: DailySummaryCreateInput): DailySummary {
    return new DailySummary({ ...input, id: randomUUID(), createdAt: new Date() });
  }

  static fromProps(props: DailySummaryProps): DailySummary {
    return new DailySummary(props);
  }

  toProps(): DailySummaryProps {
    return {
      id: this.id,
      userId: this.userId,
      date: this.date,
      content: this.content,
      sessionCount: this.sessionCount,
      messageCount: this.messageCount,
      tokensUsed: this.tokensUsed,
      cost: this.cost,
      metadata: this.metadata,
      createdAt: this.createdAt,
    };
  }
}
