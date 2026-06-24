/**
 * T25: Harness auto-loop runner — Planner→Coder→Smoke→Evaluator→retry.
 * Orchestrates RunCoderRoundUseCase + optional SmokeTest gate + EvaluateRoundUseCase
 * in a loop until passed or maxRounds exhausted.
 */

import type { HarnessRoundRepo, HarnessSprintRepo } from '@wolfkrow/domain';
import type { SmokeTestRunner } from '@wolfkrow/infra';
import { EvaluateRoundUseCase, RunCoderRoundUseCase } from '@wolfkrow/use-cases';
import type { CoderAgent, EvaluatorAgent } from '@wolfkrow/use-cases';

export interface RunFeatureInput {
  sprintId: string;
  featureIndex: number;
  coderModel: string;
  maxRounds: number;
  /** Workdir where the coder wrote files; smoke test runs there. */
  workDir?: string;
  /** Files the smoke runner should expect to exist (e.g. feature outputs). */
  expectedFiles?: readonly string[];
}

export interface FeatureRunResult {
  featureIndex: number;
  rounds: number;
  passed: boolean;
  finalOutput: string | undefined;
  smokeFeedback?: string;
}

export interface ProgressEvent {
  round: number;
  status: 'passed' | 'failed';
  stage?: 'coder' | 'smoke' | 'evaluator';
}

type Repos = {
  sprintRepo: HarnessSprintRepo;
  roundRepo: HarnessRoundRepo;
};

type Agents = {
  coder: CoderAgent;
  evaluator: EvaluatorAgent;
};

type Services = {
  smokeRunner?: SmokeTestRunner;
};

export async function runHarnessFeature(
  input: RunFeatureInput,
  repos: Repos,
  agents: Agents,
  onProgress?: (event: ProgressEvent) => void,
  services: Services = {},
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

    let smokeFeedback: string | undefined;
    let smokeFailed = false;
    if (services.smokeRunner && input.workDir) {
      try {
        const result = await services.smokeRunner.run(input.workDir, [...(input.expectedFiles ?? [])]);
        const typecheckFailed = !result.typecheck.ok && result.typecheck.errors > 0;
        const lintFailed = result.lint.available && !result.lint.ok;
        const testsFailed = result.tests.available && result.tests.failed > 0;
        const importsBroken = result.brokenImports.length > 0;
        const filesMissing = result.missingFiles.length > 0;

        if (typecheckFailed || lintFailed || testsFailed || importsBroken || filesMissing) {
          const parts: string[] = ['Smoke test gate failed:'];
          if (typecheckFailed) parts.push(`- typecheck: ${result.typecheck.errors} error(s)`);
          if (lintFailed) parts.push(`- lint: ${result.lint.errors} error(s), ${result.lint.warnings} warning(s)`);
          if (testsFailed) parts.push(`- tests: ${result.tests.failed} failed`);
          if (importsBroken) {
            const sample = result.brokenImports.slice(0, 5).map((b) => `${b.file} -> ${b.importPath}`).join(', ');
            parts.push(`- broken imports: ${result.brokenImports.length} (e.g. ${sample})`);
          }
          if (filesMissing) parts.push(`- missing files: ${result.missingFiles.join(', ')}`);
          smokeFeedback = parts.join('\n');
          smokeFailed = true;
        }
      } catch (err) {
        smokeFeedback = `Smoke runner error: ${err instanceof Error ? err.message : String(err)}`;
        smokeFailed = true;
      }
    }

    if (smokeFailed) {
      onProgress?.({ round: round + 1, status: 'failed', stage: 'smoke' });
      prevFeedback = smokeFeedback;
      continue;
    }

    const { passed, round: evalRound } = await new EvaluateRoundUseCase(
      repos.roundRepo,
      agents.evaluator,
    ).execute({ roundId: coderRound.id });

    onProgress?.({ round: round + 1, status: passed ? 'passed' : 'failed', stage: 'evaluator' });

    if (passed) {
      return {
        featureIndex: input.featureIndex,
        rounds: round + 1,
        passed: true,
        finalOutput: evalRound.coderOutput ?? undefined,
        ...(smokeFeedback !== undefined ? { smokeFeedback } : {}),
      };
    }

    const evalFeedback = evalRound.evaluatorFeedback ?? '';
    prevFeedback = smokeFeedback ? `${evalFeedback}\n\n${smokeFeedback}` : evalFeedback;
  }

  return {
    featureIndex: input.featureIndex,
    rounds: input.maxRounds,
    passed: false,
    finalOutput: undefined,
  };
}
