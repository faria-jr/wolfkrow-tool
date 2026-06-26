/**
 * Harness auto-loop runner — Planner→Coder→Smoke→Evaluator→retry.
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
  workDir?: string;
  expectedFiles?: readonly string[];
}

export interface FeatureRunResult {
  featureIndex: number;
  rounds: number;
  passed: boolean;
  finalOutput: string | undefined;
  smokeFeedback?: string;
}

export type ProgressStage = 'coder' | 'smoke' | 'evaluator';

export interface ProgressEvent {
  round: number;
  status: 'passed' | 'failed';
  stage?: ProgressStage;
}

type Repos = {
  sprintRepo: HarnessSprintRepo;
  roundRepo: HarnessRoundRepo;
};

type HarnessCtx = {
  coder: CoderAgent;
  evaluator: EvaluatorAgent;
  smokeRunner?: SmokeTestRunner;
};

type SmokeFailure = { failed: true; feedback: string };
type SmokeOutcome = { failed: false; feedback: undefined } | SmokeFailure;

interface SmokeCheck {
  triggered: boolean;
  describe(): string | null;
}

function check(label: string, value: string, triggered: boolean): SmokeCheck {
  return { triggered, describe: () => triggered ? `- ${label}: ${value}` : null };
}

function collectFailureLines(checks: SmokeCheck[]): string[] {
  return checks.map((c) => c.describe()).filter((s): s is string => s !== null);
}

function extractSmokeFailure(result: Awaited<ReturnType<SmokeTestRunner['run']>>): string | null {
  const sample = result.brokenImports.slice(0, 5).map((b) => `${b.file} -> ${b.importPath}`).join(', ');
  const checks: SmokeCheck[] = [
    check('typecheck', `${result.typecheck.errors} error(s)`, !result.typecheck.ok && result.typecheck.errors > 0),
    check('lint', `${result.lint.errors} error(s), ${result.lint.warnings} warning(s)`, result.lint.available && !result.lint.ok),
    check('tests', `${result.tests.failed} failed`, result.tests.available && result.tests.failed > 0),
    check('broken imports', `${result.brokenImports.length} (e.g. ${sample})`, result.brokenImports.length > 0),
    check('missing files', result.missingFiles.join(', '), result.missingFiles.length > 0),
  ];
  const lines = collectFailureLines(checks);
  if (lines.length === 0) return null;
  return ['Smoke test gate failed:', ...lines].join('\n');
}

async function runSmoke(ctx: HarnessCtx, input: RunFeatureInput): Promise<SmokeOutcome> {
  if (!ctx.smokeRunner || !input.workDir) return { failed: false, feedback: undefined };
  try {
    const result = await ctx.smokeRunner.run(input.workDir, [...(input.expectedFiles ?? [])]);
    const feedback = extractSmokeFailure(result);
    return feedback ? { failed: true, feedback } : { failed: false, feedback: undefined };
  } catch (err) {
    return { failed: true, feedback: `Smoke runner error: ${err instanceof Error ? err.message : String(err)}` };
  }
}

function buildFinalFeedback(evalFeedback: string, smokeFeedback: string | undefined): string {
  return smokeFeedback ? `${evalFeedback}\n\n${smokeFeedback}` : evalFeedback;
}

function makeResult(args: { input: RunFeatureInput; rounds: number; passed: boolean; finalOutput: string | undefined; smokeFeedback: string | undefined }): FeatureRunResult {
  return {
    featureIndex: args.input.featureIndex,
    rounds: args.rounds,
    passed: args.passed,
    finalOutput: args.finalOutput,
    ...(args.smokeFeedback !== undefined ? { smokeFeedback: args.smokeFeedback } : {}),
  };
}

interface CoderArgs { input: RunFeatureInput; round: number; prevFeedback: string | undefined; repos: Repos; ctx: HarnessCtx; }
interface TickArgs extends CoderArgs {
  onProgress: ((event: ProgressEvent) => void) | undefined;
  onCoderChunk: ((delta: string) => void) | undefined;
  onCoderToolCall: ((call: { id: string; name: string; input: Record<string, unknown> }) => void) | undefined;
  onCoderToolResult: ((result: { callId: string; output: string; isError: boolean }) => void) | undefined;
  onEvaluatorChunk: ((delta: string) => void) | undefined;
}

interface CoderHooks {
  onCoderChunk: ((delta: string) => void) | undefined;
  onCoderToolCall: ((call: { id: string; name: string; input: Record<string, unknown> }) => void) | undefined;
  onCoderToolResult: ((result: { callId: string; output: string; isError: boolean }) => void) | undefined;
}

async function runCoder(args: CoderArgs, hooks: Partial<CoderHooks> = {}) {
  return new RunCoderRoundUseCase(args.repos.sprintRepo, args.repos.roundRepo, args.ctx.coder).execute({
    sprintId: args.input.sprintId,
    featureIndex: args.input.featureIndex,
    roundNumber: args.round + 1,
    coderModel: args.input.coderModel,
    ...(args.prevFeedback !== undefined ? { previousFeedback: args.prevFeedback } : {}),
    ...(hooks.onCoderChunk !== undefined ? { onCoderChunk: hooks.onCoderChunk } : {}),
    ...(hooks.onCoderToolCall !== undefined ? { onCoderToolCall: hooks.onCoderToolCall } : {}),
    ...(hooks.onCoderToolResult !== undefined ? { onCoderToolResult: hooks.onCoderToolResult } : {}),
  });
}

async function runEvaluator(repos: Repos, ctx: HarnessCtx, roundId: string, onEvaluatorChunk?: (delta: string) => void) {
  return new EvaluateRoundUseCase(repos.roundRepo, ctx.evaluator).execute({
    roundId,
    ...(onEvaluatorChunk !== undefined ? { onEvaluatorChunk } : {}),
  });
}

interface TickResult { result: FeatureRunResult | null; nextFeedback: string | undefined; }

async function tickRound(args: TickArgs): Promise<TickResult> {
  const coderOut = await runCoder(args, {
    onCoderChunk: args.onCoderChunk,
    onCoderToolCall: args.onCoderToolCall,
    onCoderToolResult: args.onCoderToolResult,
  });
  const smoke = await runSmoke(args.ctx, args.input);
  if (smoke.failed) {
    args.onProgress?.({ round: args.round + 1, status: 'failed', stage: 'smoke' });
    return { result: makeResult({ input: args.input, rounds: args.round + 1, passed: false, finalOutput: undefined, smokeFeedback: smoke.feedback }), nextFeedback: smoke.feedback };
  }
  const evalOut = await runEvaluator(args.repos, args.ctx, coderOut.round.id, args.onEvaluatorChunk);
  args.onProgress?.({ round: args.round + 1, status: evalOut.passed ? 'passed' : 'failed', stage: 'evaluator' });
  if (evalOut.passed) {
    const output = evalOut.round.coderOutput ?? undefined;
    return { result: makeResult({ input: args.input, rounds: args.round + 1, passed: true, finalOutput: output, smokeFeedback: smoke.feedback }), nextFeedback: undefined };
  }
  const evalFeedback = evalOut.round.evaluatorFeedback ?? '';
  return { result: null, nextFeedback: buildFinalFeedback(evalFeedback, smoke.feedback) };
}

export interface RunHarnessHooks {
  onProgress?: (event: ProgressEvent) => void;
  /** DEBT #29 — streamed coder text deltas (live output). */
  onCoderChunk?: (delta: string) => void;
  /** DEBT #29 — coder tool-call/result (live tool chips). */
  onCoderToolCall?: (call: { id: string; name: string; input: Record<string, unknown> }) => void;
  onCoderToolResult?: (result: { callId: string; output: string; isError: boolean }) => void;
  /** DEBT #29 — streamed evaluator text deltas (live output). */
  onEvaluatorChunk?: (delta: string) => void;
  /** DEBT #29 — return true to stop the coder/evaluator loop early (abort). */
  shouldAbort?: () => boolean;
}

export async function runHarnessFeature(
  input: RunFeatureInput,
  repos: Repos,
  ctx: HarnessCtx,
  hooks: RunHarnessHooks = {},
): Promise<FeatureRunResult> {
  const { onProgress, onCoderChunk, onCoderToolCall, onCoderToolResult, onEvaluatorChunk, shouldAbort } = hooks;
  let prevFeedback: string | undefined;
  for (let round = 0; round < input.maxRounds; round++) {
    // DEBT #29 — stop the coder/evaluator loop early when the run is aborted.
    if (shouldAbort?.()) {
      return makeResult({ input, rounds: round, passed: false, finalOutput: undefined, smokeFeedback: undefined });
    }
    const { result, nextFeedback } = await tickRound({ input, round, prevFeedback, repos, ctx, onProgress, onCoderChunk, onCoderToolCall, onCoderToolResult, onEvaluatorChunk });
    if (result?.passed) return result;
    prevFeedback = nextFeedback;
  }
  return makeResult({ input, rounds: input.maxRounds, passed: false, finalOutput: undefined, smokeFeedback: undefined });
}
