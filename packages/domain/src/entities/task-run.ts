import { randomUUID } from 'node:crypto';

export type TaskRunStatus = 'pending' | 'running' | 'awaiting_review' | 'validated' | 'rejected';

export interface TaskRunMetrics {
  tokens?: number;
  cost?: number;
  durationMs?: number;
  toolUses?: number;
}

export interface TaskRunProps {
  id: string;
  taskId: string;
  status: TaskRunStatus;
  startedAt: Date | undefined;
  completedAt: Date | undefined;
  output: Record<string, unknown> | undefined;
  error: string | undefined;
  reviewNote: string | undefined;
  reviewedAt: Date | undefined;
  metrics: TaskRunMetrics | undefined;
}

export type TaskRunCreateInput = Pick<TaskRunProps, 'taskId'>;

export class TaskRun {
  readonly id: string;
  readonly taskId: string;
  readonly status: TaskRunStatus;
  readonly startedAt: Date | undefined;
  readonly completedAt: Date | undefined;
  readonly output: Record<string, unknown> | undefined;
  readonly error: string | undefined;
  readonly reviewNote: string | undefined;
  readonly reviewedAt: Date | undefined;
  readonly metrics: TaskRunMetrics | undefined;

  private constructor(props: TaskRunProps) {
    this.id = props.id;
    this.taskId = props.taskId;
    this.status = props.status;
    this.startedAt = props.startedAt;
    this.completedAt = props.completedAt;
    this.output = props.output;
    this.error = props.error;
    this.reviewNote = props.reviewNote;
    this.reviewedAt = props.reviewedAt;
    this.metrics = props.metrics;
  }

  static create(input: TaskRunCreateInput): TaskRun {
    return new TaskRun({
      id: randomUUID(),
      taskId: input.taskId,
      status: 'pending',
      startedAt: undefined,
      completedAt: undefined,
      output: undefined,
      error: undefined,
      reviewNote: undefined,
      reviewedAt: undefined,
      metrics: undefined,
    });
  }

  static fromProps(props: TaskRunProps): TaskRun {
    return new TaskRun(props);
  }

  toProps(): TaskRunProps {
    return {
      id: this.id,
      taskId: this.taskId,
      status: this.status,
      startedAt: this.startedAt,
      completedAt: this.completedAt,
      output: this.output,
      error: this.error,
      reviewNote: this.reviewNote,
      reviewedAt: this.reviewedAt,
      metrics: this.metrics,
    };
  }

  start(now = new Date()): TaskRun {
    return TaskRun.fromProps({ ...this.toProps(), status: 'running', startedAt: now });
  }

  complete(
    status: 'awaiting_review' | 'validated' | 'rejected',
    opts: {
      output?: Record<string, unknown>;
      error?: string;
      metrics?: TaskRunMetrics;
      now?: Date;
    } = {}
  ): TaskRun {
    const now = opts.now ?? new Date();
    return TaskRun.fromProps({
      ...this.toProps(),
      status,
      completedAt: now,
      ...(opts.output !== undefined ? { output: opts.output } : {}),
      ...(opts.error !== undefined ? { error: opts.error } : {}),
      ...(opts.metrics !== undefined ? { metrics: opts.metrics } : {}),
    });
  }

  review(status: 'validated' | 'rejected', note?: string, now = new Date()): TaskRun {
    return TaskRun.fromProps({
      ...this.toProps(),
      status,
      reviewedAt: now,
      ...(note !== undefined ? { reviewNote: note } : {}),
    });
  }
}
