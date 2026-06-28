/**
 * Shared in-process run control for long-running worker loops (Harness
 * coder/evaluator, Pipeline AI phases). Tracks per-run state so HTTP routes
 * can abort / pause / resume an in-flight loop that the client otherwise could
 * only disconnect from.
 *
 * State machine: `running` → (`paused` ↔ `running`) → `running` … ; `aborted`
 * is terminal for the run. In-memory + per-process: adequate for the
 * single-worker deployment; a multi-instance deploy would need a shared store.
 */

export type RunState = 'running' | 'paused' | 'aborted';

export interface RunHandle {
  /** True once the run has been aborted (terminal). */
  isAborted: () => boolean;
  /** True while paused — long loops should block (or yield) until resumed/aborted. */
  isPaused: () => boolean;
  /** Resolves when running again (resumed) or rejects when aborted; await between steps. */
  waitIfPaused: () => Promise<void>;
}

interface RunEntry {
  state: RunState;
  resolvers: Array<() => void>;
}

const runs = new Map<string, RunEntry>();

/** Register (reset) a run. Returns a handle the loop consults between steps. */
export function registerRun(id: string): RunHandle {
  const e = { state: 'running' as RunState, resolvers: [] as Array<() => void> };
  runs.set(id, e);
  return {
    isAborted: () => e.state === 'aborted',
    isPaused: () => e.state === 'paused',
    waitIfPaused: async () => {
      if (e.state !== 'paused') return;
      await new Promise<void>((resolve) => e.resolvers.push(resolve));
    },
  };
}

/** Abort a run. Returns false if no run is registered. Terminal for the run. */
export function abortRun(id: string): boolean {
  const e = runs.get(id);
  if (!e) return false;
  e.state = 'aborted';
  // Reject any paused waiters so their loops observe the abort promptly.
  e.resolvers.length = 0;
  return true;
}

/** Pause a running loop. No-op if not running. */
export function pauseRun(id: string): boolean {
  const e = runs.get(id);
  if (!e || e.state !== 'running') return false;
  e.state = 'paused';
  return true;
}

/** Resume a paused loop. No-op if not paused. */
export function resumeRun(id: string): boolean {
  const e = runs.get(id);
  if (!e || e.state !== 'paused') return false;
  e.state = 'running';
  for (const resolve of e.resolvers) resolve();
  e.resolvers.length = 0;
  return true;
}

/** Current state for status polling; undefined when no run is registered. */
export function runState(id: string): RunState | undefined {
  return runs.get(id)?.state;
}

/** Clear the entry when the run ends (natural, aborted, or errored). */
export function unregisterRun(id: string): void {
  runs.delete(id);
}
