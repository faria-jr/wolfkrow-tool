import { randomUUID } from 'node:crypto';

export type SprintStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

export interface SprintFeature {
  name: string;
  description: string;
  acceptanceCriteria: string[];
}

export interface SprintMetrics {
  roundCount: number;
  featuresPassed: number;
  featuresTotal: number;
  durationMs: number;
}

export interface HarnessSprintProps {
  id: string;
  projectId: string;
  number: number;
  name: string;
  description: string | undefined;
  status: SprintStatus;
  features: SprintFeature[];
  startedAt: Date | undefined;
  completedAt: Date | undefined;
  metrics: SprintMetrics;
}

export type HarnessSprintCreateInput = Omit<
  HarnessSprintProps,
  'id' | 'status' | 'startedAt' | 'completedAt' | 'metrics'
>;

export class HarnessSprint {
  readonly id: string;
  readonly projectId: string;
  readonly number: number;
  readonly name: string;
  readonly description: string | undefined;
  readonly status: SprintStatus;
  readonly features: SprintFeature[];
  readonly startedAt: Date | undefined;
  readonly completedAt: Date | undefined;
  readonly metrics: SprintMetrics;

  private constructor(props: HarnessSprintProps) {
    this.id = props.id;
    this.projectId = props.projectId;
    this.number = props.number;
    this.name = props.name;
    this.description = props.description;
    this.status = props.status;
    this.features = props.features;
    this.startedAt = props.startedAt;
    this.completedAt = props.completedAt;
    this.metrics = props.metrics;
  }

  static create(input: HarnessSprintCreateInput): HarnessSprint {
    return new HarnessSprint({
      ...input,
      id: randomUUID(),
      status: 'pending',
      startedAt: undefined,
      completedAt: undefined,
      metrics: {
        roundCount: 0,
        featuresPassed: 0,
        featuresTotal: input.features.length,
        durationMs: 0,
      },
    });
  }

  static fromProps(props: HarnessSprintProps): HarnessSprint {
    return new HarnessSprint(props);
  }

  toProps(): HarnessSprintProps {
    return {
      id: this.id,
      projectId: this.projectId,
      number: this.number,
      name: this.name,
      description: this.description,
      status: this.status,
      features: this.features,
      startedAt: this.startedAt,
      completedAt: this.completedAt,
      metrics: this.metrics,
    };
  }

  withStatus(status: SprintStatus, now = new Date()): HarnessSprint {
    return HarnessSprint.fromProps({
      ...this.toProps(),
      status,
      ...(status === 'in_progress' ? { startedAt: now } : {}),
      ...(status === 'completed' || status === 'failed' ? { completedAt: now } : {}),
    });
  }
}
