import { randomUUID } from 'node:crypto';

export type WorkflowRunStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface WorkflowMetrics {
  durationMs: number;
  stepCount: number;
}

export interface WorkflowRunProps {
  id: string;
  userId: string;
  workflowName: string;
  status: WorkflowRunStatus;
  input: Record<string, unknown>;
  output: Record<string, unknown> | undefined;
  error: string | undefined;
  startedAt: Date | undefined;
  completedAt: Date | undefined;
  metrics: WorkflowMetrics;
  createdAt: Date;
}

export type WorkflowRunCreateInput = Pick<WorkflowRunProps, 'userId' | 'workflowName' | 'input'>;

export class WorkflowRun {
  readonly id: string;
  readonly userId: string;
  readonly workflowName: string;
  readonly status: WorkflowRunStatus;
  readonly input: Record<string, unknown>;
  readonly output: Record<string, unknown> | undefined;
  readonly error: string | undefined;
  readonly startedAt: Date | undefined;
  readonly completedAt: Date | undefined;
  readonly metrics: WorkflowMetrics;
  readonly createdAt: Date;

  private constructor(props: WorkflowRunProps) {
    this.id = props.id;
    this.userId = props.userId;
    this.workflowName = props.workflowName;
    this.status = props.status;
    this.input = props.input;
    this.output = props.output;
    this.error = props.error;
    this.startedAt = props.startedAt;
    this.completedAt = props.completedAt;
    this.metrics = props.metrics;
    this.createdAt = props.createdAt;
  }

  static create(input: WorkflowRunCreateInput): WorkflowRun {
    const now = new Date();
    return new WorkflowRun({
      id: randomUUID(),
      userId: input.userId,
      workflowName: input.workflowName,
      status: 'pending',
      input: input.input,
      output: undefined,
      error: undefined,
      startedAt: undefined,
      completedAt: undefined,
      metrics: { durationMs: 0, stepCount: 0 },
      createdAt: now,
    });
  }

  static fromProps(props: WorkflowRunProps): WorkflowRun {
    return new WorkflowRun(props);
  }

  toProps(): WorkflowRunProps {
    return {
      id: this.id,
      userId: this.userId,
      workflowName: this.workflowName,
      status: this.status,
      input: this.input,
      output: this.output,
      error: this.error,
      startedAt: this.startedAt,
      completedAt: this.completedAt,
      metrics: this.metrics,
      createdAt: this.createdAt,
    };
  }

  start(now = new Date()): WorkflowRun {
    return WorkflowRun.fromProps({ ...this.toProps(), status: 'running', startedAt: now });
  }

  complete(output: Record<string, unknown>, stepCount: number, now = new Date()): WorkflowRun {
    return WorkflowRun.fromProps({
      ...this.toProps(),
      status: 'completed',
      output,
      completedAt: now,
      metrics: {
        durationMs: now.getTime() - (this.startedAt?.getTime() ?? now.getTime()),
        stepCount,
      },
    });
  }

  fail(error: string, now = new Date()): WorkflowRun {
    return WorkflowRun.fromProps({ ...this.toProps(), status: 'failed', error, completedAt: now });
  }
}
