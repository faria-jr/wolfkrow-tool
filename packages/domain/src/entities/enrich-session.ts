import { randomUUID } from 'node:crypto';

export type EnrichStatus = 'pending' | 'validator' | 'enricher' | 'completed' | 'cancelled';

export interface EnrichMetrics {
  tokens: number;
  durationMs: number;
}

export interface EnrichSessionProps {
  id: string;
  userId: string;
  specPath: string;
  status: EnrichStatus;
  validatorAgentId: string | undefined;
  enricherAgentId: string | undefined;
  validatorMetrics: EnrichMetrics;
  enricherMetrics: EnrichMetrics;
  startedAt: Date | undefined;
  completedAt: Date | undefined;
}

export type EnrichSessionCreateInput = Pick<EnrichSessionProps, 'userId' | 'specPath'> & {
  validatorAgentId?: string;
  enricherAgentId?: string;
};

export class EnrichSession {
  readonly id: string;
  readonly userId: string;
  readonly specPath: string;
  readonly status: EnrichStatus;
  readonly validatorAgentId: string | undefined;
  readonly enricherAgentId: string | undefined;
  readonly validatorMetrics: EnrichMetrics;
  readonly enricherMetrics: EnrichMetrics;
  readonly startedAt: Date | undefined;
  readonly completedAt: Date | undefined;

  private constructor(props: EnrichSessionProps) {
    this.id = props.id;
    this.userId = props.userId;
    this.specPath = props.specPath;
    this.status = props.status;
    this.validatorAgentId = props.validatorAgentId;
    this.enricherAgentId = props.enricherAgentId;
    this.validatorMetrics = props.validatorMetrics;
    this.enricherMetrics = props.enricherMetrics;
    this.startedAt = props.startedAt;
    this.completedAt = props.completedAt;
  }

  static create(input: EnrichSessionCreateInput): EnrichSession {
    return new EnrichSession({
      id: randomUUID(),
      userId: input.userId,
      specPath: input.specPath,
      status: 'pending',
      validatorAgentId: input.validatorAgentId,
      enricherAgentId: input.enricherAgentId,
      validatorMetrics: { tokens: 0, durationMs: 0 },
      enricherMetrics: { tokens: 0, durationMs: 0 },
      startedAt: undefined,
      completedAt: undefined,
    });
  }

  static fromProps(props: EnrichSessionProps): EnrichSession {
    return new EnrichSession(props);
  }

  toProps(): EnrichSessionProps {
    return {
      id: this.id,
      userId: this.userId,
      specPath: this.specPath,
      status: this.status,
      validatorAgentId: this.validatorAgentId,
      enricherAgentId: this.enricherAgentId,
      validatorMetrics: this.validatorMetrics,
      enricherMetrics: this.enricherMetrics,
      startedAt: this.startedAt,
      completedAt: this.completedAt,
    };
  }

  startValidator(now = new Date()): EnrichSession {
    return EnrichSession.fromProps({ ...this.toProps(), status: 'validator', startedAt: now });
  }

  startEnricher(): EnrichSession {
    return EnrichSession.fromProps({ ...this.toProps(), status: 'enricher' });
  }

  completeValidator(tokens: number, durationMs: number): EnrichSession {
    return EnrichSession.fromProps({ ...this.toProps(), validatorMetrics: { tokens, durationMs } });
  }

  completeEnricher(tokens: number, durationMs: number, now = new Date()): EnrichSession {
    return EnrichSession.fromProps({
      ...this.toProps(),
      status: 'completed',
      completedAt: now,
      enricherMetrics: { tokens, durationMs },
    });
  }

  cancel(now = new Date()): EnrichSession {
    return EnrichSession.fromProps({ ...this.toProps(), status: 'cancelled', completedAt: now });
  }
}
