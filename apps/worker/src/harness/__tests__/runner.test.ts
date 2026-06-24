/**
 * Tests: T25 — runHarnessFeature auto loop (Planner→Coder→Smoke→Evaluator→retry).
 */

import type { HarnessRoundRepo, HarnessSprintRepo } from '@wolfkrow/domain';
import { HarnessSprint, HarnessRound } from '@wolfkrow/domain';
import type { SmokeTestRunner } from '@wolfkrow/infra';
import type { CoderAgent, EvaluatorAgent } from '@wolfkrow/use-cases';
import { describe, expect, it, vi } from 'vitest';

import { runHarnessFeature } from '../runner';

const BASE_SPRINT_PROPS = {
  id: 'sprint-1',
  projectId: 'proj-1',
  number: 1,
  name: 'Sprint 1',
  description: 'desc',
  features: [{ name: 'Auth', description: 'login flow', acceptanceCriteria: ['must authenticate'] }],
  status: 'pending' as const,
  startedAt: undefined,
  completedAt: undefined,
  metrics: { roundCount: 0, featuresPassed: 0, featuresTotal: 1, durationMs: 0 },
};

function makeSprintRepo(sprint = HarnessSprint.fromProps(BASE_SPRINT_PROPS)): HarnessSprintRepo {
  return {
    findById: vi.fn().mockResolvedValue(sprint),
    findByProjectId: vi.fn().mockResolvedValue([]),
    save: vi.fn().mockResolvedValue(sprint),
  };
}

function makeRoundRepo(): HarnessRoundRepo {
  const rounds = new Map<string, HarnessRound>();
  let seq = 0;
  return {
    save: vi.fn().mockImplementation(async (r: HarnessRound) => {
      const id = r.id ?? `round-${++seq}`;
      const saved = HarnessRound.fromProps({ ...r.toProps(), id });
      rounds.set(id, saved);
      return saved;
    }),
    findById: vi.fn().mockImplementation(async (id: string) => rounds.get(id) ?? null),
    findBySprintId: vi.fn().mockResolvedValue([]),
    findBySprintAndFeature: vi.fn().mockResolvedValue([]),
  };
}

function makeCoder(impl: CoderAgent['implement']): CoderAgent {
  return { implement: impl };
}

function makeEvaluator(eval_: EvaluatorAgent['evaluate']): EvaluatorAgent {
  return { evaluate: eval_ };
}

describe('runHarnessFeature', () => {
  it('returns passed=true after 1 round when evaluator passes', async () => {
    const coder = makeCoder(async () => ({ output: 'code output', tokens: 10 }));
    const evaluator = makeEvaluator(async () => ({ passed: true, feedback: 'looks good', tokens: 5 }));

    const result = await runHarnessFeature(
      { sprintId: 'sprint-1', featureIndex: 0, coderModel: 'claude-sonnet-4-6', maxRounds: 5 },
      { sprintRepo: makeSprintRepo(), roundRepo: makeRoundRepo() },
      { coder, evaluator },
    );

    expect(result.passed).toBe(true);
    expect(result.rounds).toBe(1);
    expect(result.featureIndex).toBe(0);
  });

  it('retries on failure and passes on second round', async () => {
    let callCount = 0;
    const evaluator = makeEvaluator(async () => {
      callCount++;
      return callCount < 2
        ? { passed: false, feedback: 'needs work', tokens: 5 }
        : { passed: true, feedback: 'ok', tokens: 5 };
    });
    const coder = makeCoder(async (input) => ({ output: `out${input.previousFeedback ?? ''}`, tokens: 10 }));

    const result = await runHarnessFeature(
      { sprintId: 'sprint-1', featureIndex: 0, coderModel: 'claude-sonnet-4-6', maxRounds: 5 },
      { sprintRepo: makeSprintRepo(), roundRepo: makeRoundRepo() },
      { coder, evaluator },
    );

    expect(result.passed).toBe(true);
    expect(result.rounds).toBe(2);
  });

  it('passes feedback from evaluator to next coder call', async () => {
    const coderInputs: string[] = [];
    const coder = makeCoder(async (input) => {
      coderInputs.push(input.previousFeedback ?? '');
      return { output: 'code', tokens: 10 };
    });
    let evalCall = 0;
    const evaluator = makeEvaluator(async () => {
      evalCall++;
      return evalCall < 2
        ? { passed: false, feedback: 'fix auth', tokens: 5 }
        : { passed: true, feedback: 'ok', tokens: 5 };
    });

    await runHarnessFeature(
      { sprintId: 'sprint-1', featureIndex: 0, coderModel: 'claude-sonnet-4-6', maxRounds: 5 },
      { sprintRepo: makeSprintRepo(), roundRepo: makeRoundRepo() },
      { coder, evaluator },
    );

    expect(coderInputs[0]).toBe('');
    expect(coderInputs[1]).toBe('fix auth');
  });

  it('exhausts maxRounds and returns passed=false', async () => {
    const coder = makeCoder(async () => ({ output: 'code', tokens: 10 }));
    const evaluator = makeEvaluator(async () => ({ passed: false, feedback: 'still broken', tokens: 5 }));

    const result = await runHarnessFeature(
      { sprintId: 'sprint-1', featureIndex: 0, coderModel: 'claude-sonnet-4-6', maxRounds: 3 },
      { sprintRepo: makeSprintRepo(), roundRepo: makeRoundRepo() },
      { coder, evaluator },
    );

    expect(result.passed).toBe(false);
    expect(result.rounds).toBe(3);
  });

  it('calls onProgress for each round', async () => {
    const progress: Array<{ round: number; status: string; stage?: string }> = [];
    const evaluator = makeEvaluator(async () => ({ passed: true, feedback: 'ok', tokens: 5 }));
    const coder = makeCoder(async () => ({ output: 'code', tokens: 10 }));

    await runHarnessFeature(
      { sprintId: 'sprint-1', featureIndex: 0, coderModel: 'claude-sonnet-4-6', maxRounds: 5 },
      { sprintRepo: makeSprintRepo(), roundRepo: makeRoundRepo() },
      { coder, evaluator },
      (msg) => progress.push(msg),
    );

    expect(progress).toHaveLength(1);
    expect(progress[0]).toMatchObject({ round: 1, status: 'passed' });
  });
});

describe('runHarnessFeature — smoke gate', () => {
  it('blocks the round with smoke feedback when broken imports detected', async () => {
    const coderInputs: string[] = [];
    const coder = makeCoder(async (input) => {
      coderInputs.push(input.previousFeedback ?? '');
      return { output: 'code', tokens: 10 };
    });
    const evaluator = makeEvaluator(async () => ({ passed: true, feedback: 'ok', tokens: 5 }));
    const smokeRunner = {
      run: vi.fn().mockResolvedValue({
        typecheck: { ok: true, errors: 0, output: '' },
        lint: { available: false, ok: true, warnings: 0, errors: 0, output: '' },
        tests: { available: false, passed: 0, failed: 0, output: '' },
        brokenImports: [{ file: 'src/x.ts', importPath: './missing' }],
        missingFiles: [],
        durationMs: 1,
      }),
    } as unknown as SmokeTestRunner;

    const result = await runHarnessFeature(
      {
        sprintId: 'sprint-1',
        featureIndex: 0,
        coderModel: 'claude-sonnet-4-6',
        maxRounds: 2,
        workDir: '/tmp/work',
      },
      { sprintRepo: makeSprintRepo(), roundRepo: makeRoundRepo() },
      { coder, evaluator, smokeRunner },
      undefined,
    );

    expect(result.passed).toBe(false);
    expect(smokeRunner.run).toHaveBeenCalled();
    // First round: empty feedback. Second round: smoke feedback injected.
    expect(coderInputs[0]).toBe('');
    expect(coderInputs[1]).toMatch(/Smoke test gate failed/);
    expect(coderInputs[1]).toMatch(/broken imports/);
  });

  it('skips smoke gate when workDir is absent', async () => {
    const coder = makeCoder(async () => ({ output: 'code', tokens: 10 }));
    const evaluator = makeEvaluator(async () => ({ passed: true, feedback: 'ok', tokens: 5 }));
    const smokeRunner = { run: vi.fn() } as unknown as SmokeTestRunner;

    const result = await runHarnessFeature(
      { sprintId: 'sprint-1', featureIndex: 0, coderModel: 'claude-sonnet-4-6', maxRounds: 2 },
      { sprintRepo: makeSprintRepo(), roundRepo: makeRoundRepo() },
      { coder, evaluator, smokeRunner },
      undefined,
    );

    expect(result.passed).toBe(true);
    expect(smokeRunner.run).not.toHaveBeenCalled();
  });
});
