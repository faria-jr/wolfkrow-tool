import type { HarnessRound, HarnessRoundRepo } from '@wolfkrow/domain';
import { NotFoundError } from '@wolfkrow/domain';

export interface EvaluatorAgent {
  evaluate(input: {
    coderOutput: string;
    acceptanceCriteria: string[];
    /** DEBT #29 — streamed text deltas (live evaluator output). */
    onChunk?: (delta: string) => void;
  }): Promise<{ passed: boolean; feedback: string; tokens: number }>;
}

export interface EvaluateRoundInput {
  roundId: string;
  /** DEBT #29 — forwarded to the evaluator as onChunk for live streaming. */
  onEvaluatorChunk?: (delta: string) => void;
}

export interface EvaluateRoundOutput {
  round: HarnessRound;
  passed: boolean;
}

export class EvaluateRoundUseCase {
  constructor(
    private readonly roundRepo: HarnessRoundRepo,
    private readonly evaluator: EvaluatorAgent
  ) {}

  async execute(input: EvaluateRoundInput): Promise<EvaluateRoundOutput> {
    const round = await this.roundRepo.findById(input.roundId);
    if (!round) throw new NotFoundError('HarnessRound', input.roundId);

    const result = await this.evaluator.evaluate({
      coderOutput: round.coderOutput ?? '',
      acceptanceCriteria: [],
      ...(input.onEvaluatorChunk !== undefined ? { onChunk: input.onEvaluatorChunk } : {}),
    });

    const completed = await this.roundRepo.save(
      round.complete(result.passed ? 'passed' : 'failed', result.feedback, result.tokens)
    );

    return { round: completed, passed: result.passed };
  }
}
