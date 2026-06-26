import { randomUUID } from 'node:crypto';

export type PipelineStage = 'discovery' | 'spec_build' | 'spec_validate' | 'approval' | 'design' | 'design_lock' | 'implementation' | 'completed';
export type PipelineStatus = 'running' | 'paused' | 'awaiting_approval' | 'completed' | 'failed' | 'cancelled';

export interface PipelineMetrics {
  totalTokens: number;
  totalCost: number;
  phasesCompleted: number;
  durationMs: number;
}

export interface PipelineProjectProps {
  id: string;
  userId: string;
  name: string;
  description: string | undefined;
  currentStage: PipelineStage;
  status: PipelineStatus;
  discoveryNotes: string | undefined;
  specPath: string | undefined;
  prdPath: string | undefined;
  approvalNotes: string | undefined;
  specEdits: string | undefined;
  harnessProjectId: string | undefined;
  metrics: PipelineMetrics;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | undefined;
}

export type PipelineProjectCreateInput = Pick<PipelineProjectProps, 'userId' | 'name'> & { description?: string };

const DEFAULT_METRICS: PipelineMetrics = { totalTokens: 0, totalCost: 0, phasesCompleted: 0, durationMs: 0 };

export class PipelineProject {
  readonly id: string;
  readonly userId: string;
  readonly name: string;
  readonly description: string | undefined;
  readonly currentStage: PipelineStage;
  readonly status: PipelineStatus;
  readonly discoveryNotes: string | undefined;
  readonly specPath: string | undefined;
  readonly prdPath: string | undefined;
  readonly approvalNotes: string | undefined;
  readonly specEdits: string | undefined;
  readonly harnessProjectId: string | undefined;
  readonly metrics: PipelineMetrics;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly completedAt: Date | undefined;

  private constructor(props: PipelineProjectProps) {
    this.id = props.id;
    this.userId = props.userId;
    this.name = props.name;
    this.description = props.description;
    this.currentStage = props.currentStage;
    this.status = props.status;
    this.discoveryNotes = props.discoveryNotes;
    this.specPath = props.specPath;
    this.prdPath = props.prdPath;
    this.approvalNotes = props.approvalNotes;
    this.specEdits = props.specEdits;
    this.harnessProjectId = props.harnessProjectId;
    this.metrics = props.metrics;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
    this.completedAt = props.completedAt;
  }

  static create(input: PipelineProjectCreateInput): PipelineProject {
    const now = new Date();
    return new PipelineProject({
      id: randomUUID(),
      userId: input.userId,
      name: input.name,
      description: input.description,
      currentStage: 'discovery',
      status: 'running',
      discoveryNotes: undefined,
      specPath: undefined,
      prdPath: undefined,
      approvalNotes: undefined,
      specEdits: undefined,
      harnessProjectId: undefined,
      metrics: { ...DEFAULT_METRICS },
      createdAt: now,
      updatedAt: now,
      completedAt: undefined,
    });
  }

  static fromProps(props: PipelineProjectProps): PipelineProject {
    return new PipelineProject(props);
  }

  toProps(): PipelineProjectProps {
    return {
      id: this.id, userId: this.userId, name: this.name, description: this.description,
      currentStage: this.currentStage, status: this.status, discoveryNotes: this.discoveryNotes,
      specPath: this.specPath, prdPath: this.prdPath, approvalNotes: this.approvalNotes,
      specEdits: this.specEdits, harnessProjectId: this.harnessProjectId,
      metrics: this.metrics, createdAt: this.createdAt, updatedAt: this.updatedAt, completedAt: this.completedAt,
    };
  }

  withStage(stage: PipelineStage, extraProps?: Partial<Pick<PipelineProjectProps, 'discoveryNotes' | 'specPath' | 'prdPath' | 'approvalNotes' | 'specEdits' | 'harnessProjectId' | 'status' | 'completedAt'>>): PipelineProject {
    return PipelineProject.fromProps({
      ...this.toProps(), currentStage: stage, updatedAt: new Date(),
      ...(extraProps ?? {}),
    });
  }

  withStatus(status: PipelineStatus, completedAt?: Date): PipelineProject {
    return PipelineProject.fromProps({
      ...this.toProps(), status, updatedAt: new Date(),
      ...(completedAt !== undefined ? { completedAt } : {}),
    });
  }

  withMetrics(metrics: Partial<PipelineMetrics>): PipelineProject {
    return PipelineProject.fromProps({
      ...this.toProps(), metrics: { ...this.metrics, ...metrics }, updatedAt: new Date(),
    });
  }
}
