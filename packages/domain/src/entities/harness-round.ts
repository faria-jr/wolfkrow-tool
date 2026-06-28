import { randomUUID } from 'node:crypto';

export type RoundStatus =
  | 'coder_running'
  | 'evaluator_running'
  | 'passed'
  | 'failed'
  | 'max_rounds_reached';

export interface RoundMetrics {
  coderTokens: number;
  evaluatorTokens: number;
  durationMs: number;
}

export interface HarnessRoundProps {
  id: string;
  sprintId: string;
  featureIndex: number;
  roundNumber: number;
  status: RoundStatus;
  coderOutput: string | undefined;
  evaluatorFeedback: string | undefined;
  metrics: RoundMetrics;
  startedAt: Date;
  completedAt: Date | undefined;
}

export type HarnessRoundCreateInput = Pick<
  HarnessRoundProps,
  'sprintId' | 'featureIndex' | 'roundNumber'
>;

export class HarnessRound {
  readonly id: string;
  readonly sprintId: string;
  readonly featureIndex: number;
  readonly roundNumber: number;
  readonly status: RoundStatus;
  readonly coderOutput: string | undefined;
  readonly evaluatorFeedback: string | undefined;
  readonly metrics: RoundMetrics;
  readonly startedAt: Date;
  readonly completedAt: Date | undefined;

  private constructor(props: HarnessRoundProps) {
    this.id = props.id;
    this.sprintId = props.sprintId;
    this.featureIndex = props.featureIndex;
    this.roundNumber = props.roundNumber;
    this.status = props.status;
    this.coderOutput = props.coderOutput;
    this.evaluatorFeedback = props.evaluatorFeedback;
    this.metrics = props.metrics;
    this.startedAt = props.startedAt;
    this.completedAt = props.completedAt;
  }

  static create(input: HarnessRoundCreateInput): HarnessRound {
    return new HarnessRound({
      ...input,
      id: randomUUID(),
      status: 'coder_running',
      coderOutput: undefined,
      evaluatorFeedback: undefined,
      metrics: { coderTokens: 0, evaluatorTokens: 0, durationMs: 0 },
      startedAt: new Date(),
      completedAt: undefined,
    });
  }

  static fromProps(props: HarnessRoundProps): HarnessRound {
    return new HarnessRound(props);
  }

  toProps(): HarnessRoundProps {
    return {
      id: this.id,
      sprintId: this.sprintId,
      featureIndex: this.featureIndex,
      roundNumber: this.roundNumber,
      status: this.status,
      coderOutput: this.coderOutput,
      evaluatorFeedback: this.evaluatorFeedback,
      metrics: this.metrics,
      startedAt: this.startedAt,
      completedAt: this.completedAt,
    };
  }

  withCoderOutput(output: string, tokens: number): HarnessRound {
    return HarnessRound.fromProps({
      ...this.toProps(),
      status: 'evaluator_running',
      coderOutput: output,
      metrics: { ...this.metrics, coderTokens: tokens },
    });
  }

  complete(
    status: 'passed' | 'failed' | 'max_rounds_reached',
    feedback?: string,
    evaluatorTokens = 0
  ): HarnessRound {
    return HarnessRound.fromProps({
      ...this.toProps(),
      status,
      completedAt: new Date(),
      ...(feedback !== undefined ? { evaluatorFeedback: feedback } : {}),
      metrics: {
        ...this.metrics,
        evaluatorTokens,
        durationMs: Date.now() - this.startedAt.getTime(),
      },
    });
  }
}
