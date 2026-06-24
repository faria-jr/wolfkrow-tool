import { randomUUID } from 'node:crypto';

export type HarnessProjectStatus = 'planning' | 'ready' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';

export interface HarnessConfig {
  maxRoundsPerFeature: number;
  coderModel: string;
  plannerModel: string;
  providerId?: string;
}

export interface ProjectMetrics {
  totalTokens: number;
  totalCost: number;
  roundCount: number;
  featuresPassed: number;
  featuresTotal: number;
  totalDurationMs: number;
}

export interface HarnessProjectProps {
  id: string;
  userId: string;
  name: string;
  description: string | undefined;
  specPath: string;
  status: HarnessProjectStatus;
  config: HarnessConfig;
  metrics: ProjectMetrics;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | undefined;
}

export type HarnessProjectCreateInput = Omit<HarnessProjectProps, 'id' | 'status' | 'metrics' | 'createdAt' | 'updatedAt' | 'completedAt'>;

const DEFAULT_CONFIG: HarnessConfig = {
  maxRoundsPerFeature: 5,
  coderModel: 'claude-sonnet-4-6',
  plannerModel: 'claude-opus-4-8',
};

const DEFAULT_METRICS: ProjectMetrics = {
  totalTokens: 0, totalCost: 0, roundCount: 0,
  featuresPassed: 0, featuresTotal: 0, totalDurationMs: 0,
};

export class HarnessProject {
  readonly id: string;
  readonly userId: string;
  readonly name: string;
  readonly description: string | undefined;
  readonly specPath: string;
  readonly status: HarnessProjectStatus;
  readonly config: HarnessConfig;
  readonly metrics: ProjectMetrics;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly completedAt: Date | undefined;

  private constructor(props: HarnessProjectProps) {
    this.id = props.id;
    this.userId = props.userId;
    this.name = props.name;
    this.description = props.description;
    this.specPath = props.specPath;
    this.status = props.status;
    this.config = props.config;
    this.metrics = props.metrics;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
    this.completedAt = props.completedAt;
  }

  static create(input: HarnessProjectCreateInput): HarnessProject {
    const now = new Date();
    return new HarnessProject({
      ...input,
      id: randomUUID(),
      status: 'planning',
      config: { ...DEFAULT_CONFIG, ...input.config },
      metrics: { ...DEFAULT_METRICS },
      createdAt: now,
      updatedAt: now,
      completedAt: undefined,
    });
  }

  static fromProps(props: HarnessProjectProps): HarnessProject {
    return new HarnessProject(props);
  }

  toProps(): HarnessProjectProps {
    return {
      id: this.id, userId: this.userId, name: this.name, description: this.description,
      specPath: this.specPath, status: this.status, config: this.config, metrics: this.metrics,
      createdAt: this.createdAt, updatedAt: this.updatedAt, completedAt: this.completedAt,
    };
  }

  withStatus(status: HarnessProjectStatus, completedAt?: Date): HarnessProject {
    return HarnessProject.fromProps({
      ...this.toProps(), status, updatedAt: new Date(),
      ...(completedAt !== undefined ? { completedAt } : {}),
    });
  }

  withMetrics(metrics: Partial<ProjectMetrics>): HarnessProject {
    return HarnessProject.fromProps({
      ...this.toProps(),
      metrics: { ...this.metrics, ...metrics },
      updatedAt: new Date(),
    });
  }
}
