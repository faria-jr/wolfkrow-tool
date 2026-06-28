import { randomUUID } from 'node:crypto';

import type { PipelineStage } from './pipeline-project';

export type PhaseStatus =
  | 'pending'
  | 'in_progress'
  | 'awaiting_user'
  | 'completed'
  | 'failed'
  | 'skipped';

export interface PhaseMetrics {
  tokens: number;
  cost: number;
  durationMs: number;
}

export interface PipelinePhaseProps {
  id: string;
  projectId: string;
  stage: PipelineStage;
  status: PhaseStatus;
  artifactPath: string | undefined;
  startedAt: Date | undefined;
  completedAt: Date | undefined;
  metrics: PhaseMetrics;
}

export type PipelinePhaseCreateInput = Pick<PipelinePhaseProps, 'projectId' | 'stage'>;

export class PipelinePhase {
  readonly id: string;
  readonly projectId: string;
  readonly stage: PipelineStage;
  readonly status: PhaseStatus;
  readonly artifactPath: string | undefined;
  readonly startedAt: Date | undefined;
  readonly completedAt: Date | undefined;
  readonly metrics: PhaseMetrics;

  private constructor(props: PipelinePhaseProps) {
    this.id = props.id;
    this.projectId = props.projectId;
    this.stage = props.stage;
    this.status = props.status;
    this.artifactPath = props.artifactPath;
    this.startedAt = props.startedAt;
    this.completedAt = props.completedAt;
    this.metrics = props.metrics;
  }

  static create(input: PipelinePhaseCreateInput): PipelinePhase {
    return new PipelinePhase({
      id: randomUUID(),
      projectId: input.projectId,
      stage: input.stage,
      status: 'pending',
      artifactPath: undefined,
      startedAt: undefined,
      completedAt: undefined,
      metrics: { tokens: 0, cost: 0, durationMs: 0 },
    });
  }

  static fromProps(props: PipelinePhaseProps): PipelinePhase {
    return new PipelinePhase(props);
  }

  toProps(): PipelinePhaseProps {
    return {
      id: this.id,
      projectId: this.projectId,
      stage: this.stage,
      status: this.status,
      artifactPath: this.artifactPath,
      startedAt: this.startedAt,
      completedAt: this.completedAt,
      metrics: this.metrics,
    };
  }

  start(now = new Date()): PipelinePhase {
    return PipelinePhase.fromProps({ ...this.toProps(), status: 'in_progress', startedAt: now });
  }

  complete(artifactPath?: string, tokens = 0, now = new Date(), cost = 0): PipelinePhase {
    return PipelinePhase.fromProps({
      ...this.toProps(),
      status: 'completed',
      completedAt: now,
      ...(artifactPath !== undefined ? { artifactPath } : {}),
      metrics: {
        tokens,
        cost,
        durationMs: now.getTime() - (this.startedAt?.getTime() ?? now.getTime()),
      },
    });
  }

  awaitUser(): PipelinePhase {
    return PipelinePhase.fromProps({ ...this.toProps(), status: 'awaiting_user' });
  }

  fail(now = new Date()): PipelinePhase {
    return PipelinePhase.fromProps({ ...this.toProps(), status: 'failed', completedAt: now });
  }
}
