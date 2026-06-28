/**
 * Harness SSE run machinery — per-sprint feature streaming + abort registry.
 *
 * Extracted from harness.ts so the route module stays under the size limit.
 * Runs each sprint feature through the harness loop, emitting SSE events and
 * honoring server-side abort (DEBT #29).
 */

import { getHarnessProjectWorkDir, getRepos } from '../container';
import { drainFeedback } from '../harness/feedback-store';
import { registerRun, unregisterRun } from '../harness/run-registry';
import type { FeatureRunResult, RunHarnessHooks } from '../harness/runner';
import { runHarnessFeature } from '../harness/runner';

export interface SprintRunDeps {
  project: {
    id: string;
    config: { maxRoundsPerFeature: number; coderModel: string };
    projectPath: string | undefined;
  };
  sprint: { id: string; features: readonly unknown[] };
  coder: unknown;
  evaluator: unknown;
  smokeRunner: unknown;
  repos: { sprintRepo: unknown; roundRepo: unknown };
  sse: (data: unknown) => void;
}

/** runRef for a harness project run — used as the persisted-timeline key. */
function harnessRunRef(projectId: string): string {
  return `harness:${projectId}`;
}

/** Persist an emitted SSE event to the run timeline (best-effort: never let
 *  a persistence failure break the live stream). */
async function record(runRef: string, eventType: string, payload: Record<string, unknown>): Promise<void> {
  try {
    const repo = getRepos().runEvent;
    if (!repo) return;
    const events = await repo.findByRunRef(runRef);
    const seq = events.reduce((max, e) => Math.max(max, e.seq), -1) + 1;
    await repo.append(
      (await import('@wolfkrow/domain')).RunEvent.create({ runRef, workflow: 'harness', eventType, payload, seq })
    );
  } catch {
    // Persistence is best-effort — the live stream must continue.
  }
}

/** Build the per-feature SSE callback bundle for the harness loop. */
function buildFeatureCallbacks(
  deps: SprintRunDeps,
  featureIndex: number,
  isAborted: () => boolean
): RunHarnessHooks {
  const sse = deps.sse;
  const sprintId = deps.sprint.id;
  const runRef = harnessRunRef(deps.project.id);
  return {
    onProgress: (event) => {
      const p = { type: 'progress', sprintId, featureIndex, ...event };
      sse(p);
      void record(runRef, 'progress', p);
    },
    onCoderChunk: (delta) => {
      const p = { type: 'coder-chunk', sprintId, featureIndex, delta };
      sse(p);
      void record(runRef, 'coder-chunk', p);
    },
    onCoderToolCall: (call) => {
      const p = { type: 'coder-tool-call', sprintId, featureIndex, call };
      sse(p);
      void record(runRef, 'coder-tool-call', p);
    },
    onCoderToolResult: (result) => {
      const p = { type: 'coder-tool-result', sprintId, featureIndex, result };
      sse(p);
      void record(runRef, 'coder-tool-result', p);
    },
    onEvaluatorChunk: (delta) => {
      const p = { type: 'evaluator-chunk', sprintId, featureIndex, delta };
      sse(p);
      void record(runRef, 'evaluator-chunk', p);
    },
    shouldAbort: isAborted,
  };
}

/** Runs each sprint feature through the harness loop, emitting SSE + honoring abort. */
export async function streamSprintRun(deps: SprintRunDeps): Promise<void> {
  const runRef = harnessRunRef(deps.project.id);
  // Clear the previous timeline so console replay shows only this run.
  try {
    await getRepos().runEvent?.deleteByRunRef(runRef);
  } catch {
    // Best-effort — the live stream must continue even if persistence is absent.
  }
  const isAborted = registerRun(deps.project.id);
  const results: FeatureRunResult[] = [];
  const workDir = deps.project.projectPath ?? getHarnessProjectWorkDir(deps.project.id);
  try {
    for (let i = 0; i < deps.sprint.features.length; i++) {
      if (isAborted()) {
        const p = { type: 'aborted', featureIndex: i };
        deps.sse(p);
        void record(runRef, 'aborted', p);
        break;
      }
      // Drain any operator HITL feedback parked for this feature so the
      // harness chat actually steers the next coder round.
      const operatorFeedback = drainFeedback(deps.project.id, i);
      const result = await runHarnessFeature(
        {
          sprintId: deps.sprint.id,
          featureIndex: i,
          coderModel: deps.project.config.coderModel,
          maxRounds: deps.project.config.maxRoundsPerFeature,
          workDir,
          ...(operatorFeedback ? { operatorFeedback } : {}),
        },
        deps.repos as Parameters<typeof runHarnessFeature>[1],
        {
          coder: deps.coder,
          evaluator: deps.evaluator,
          smokeRunner: deps.smokeRunner,
        } as Parameters<typeof runHarnessFeature>[2],
        buildFeatureCallbacks(deps, i, isAborted)
      );
      results.push(result);
      const fd = { type: 'feature_done', ...result };
      deps.sse(fd);
      void record(runRef, 'feature_done', fd);
    }
    const done = { type: 'done', results };
    deps.sse(done);
    void record(runRef, 'done', done);
  } finally {
    unregisterRun(deps.project.id);
  }
}
