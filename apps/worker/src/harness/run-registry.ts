/**
 * DEBT #29 — Server-side harness run abort.
 *
 * Tracks an abort flag per project so POST /harness/projects/:id/abort can stop
 * the in-flight coder/evaluator loop between rounds/features (the client's
 * reader.cancel() only drops the SSE consumer — the expensive AI loop keeps
 * running otherwise). In-memory + per-process: adequate for the single-worker
 * deployment; a multi-instance deploy would need a shared store.
 */

const abortFlags = new Map<string, boolean>();

/** Register (reset) the abort flag for a project run. Returns a checker. */
export function registerRun(projectId: string): () => boolean {
  abortFlags.set(projectId, false);
  return () => abortFlags.get(projectId) === true;
}

/** Mark a project's run as aborted (no-op if none registered). */
export function abortRun(projectId: string): boolean {
  if (!abortFlags.has(projectId)) return false;
  abortFlags.set(projectId, true);
  return true;
}

/** Clear the flag when the run ends (natural or aborted). */
export function unregisterRun(projectId: string): void {
  abortFlags.delete(projectId);
}
