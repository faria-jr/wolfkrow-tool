/**
 * T25: Harness auto-loop runner — Planner→Coder→Evaluator→retry.
 * Orchestrates RunCoderRoundUseCase + EvaluateRoundUseCase in a loop
 * until passed or maxRounds exhausted.
 */

import type { HarnessRoundRepo, HarnessSprintRepo } from '@wolfkrow/domain';
import { EvaluateRoundUseCase, RunCoderRoundUseCase } from '@wolfkrow/use-cases';
import type { CoderAgent, EvaluatorAgent } from '@wolfkrow/use-cases';

export interface RunFeatureInput {
  sprintId: string;
  featureIndex: number;
  coderModel: string;
  maxRounds: number;
}

export interface FeatureRunResult {
  featureIndex: number;
  rounds: number;
  passed: boolean;
  finalOutput: string | undefined;
}

export interface ProgressEvent {
  round: number;
  status: 'passed' | 'failed';
}

type Repos = {
  sprintRepo: HarnessSprintRepo;
  roundRepo: HarnessRoundRepo;
};

type Agents = {
  coder: CoderAgent;
  evaluator: EvaluatorAgent;
};

export async function runHarnessFeature(
  input: RunFeatureInput,
  repos: Repos,
  agents: Agents,
  onProgress?: (event: ProgressEvent) => void,
): Promise<FeatureRunResult> {
  let prevFeedback: string | undefined;

  for (let round = 0; round < input.maxRounds; round++) {
    const { round: coderRound } = await new RunCoderRoundUseCase(
      repos.sprintRepo,
      repos.roundRepo,
      agents.coder,
    ).execute({
      sprintId: input.sprintId,
      featureIndex: input.featureIndex,
      roundNumber: round + 1,
      coderModel: input.coderModel,
      ...(prevFeedback !== undefined ? { previousFeedback: prevFeedback } : {}),
    });

    const { passed, round: evalRound } = await new EvaluateRoundUseCase(
      repos.roundRepo,
      agents.evaluator,
    ).execute({ roundId: coderRound.id });

    onProgress?.({ round: round + 1, status: passed ? 'passed' : 'failed' });

    if (passed) {
      return {
        featureIndex: input.featureIndex,
        rounds: round + 1,
        passed: true,
        finalOutput: evalRound.coderOutput ?? undefined,
      };
    }

    prevFeedback = evalRound.evaluatorFeedback ?? '';
  }

  return {
    featureIndex: input.featureIndex,
    rounds: input.maxRounds,
    passed: false,
    finalOutput: undefined,
  };
}
