/**
 * DEBT #29 — Server-side harness run abort.
 *
 * Thin compatibility shim over the shared `run-control` module so the Harness
 * coder/evaluator loop can be aborted between rounds/features (the client's
 * reader.cancel() only drops the SSE consumer — the expensive AI loop keeps
 * running otherwise). New run-control also exposes pause/resume; legacy callers
 * keep using the abort-only API exported here.
 */

import { abortRun as controlAbort, registerRun as controlRegister, unregisterRun as controlUnregister } from '../lib/run-control';

/** Register (reset) the abort flag for a project run. Returns a checker. */
export function registerRun(projectId: string): () => boolean {
  return controlRegister(projectId).isAborted;
}

/** Mark a project's run as aborted (no-op if none registered). */
export function abortRun(projectId: string): boolean {
  return controlAbort(projectId);
}

/** Clear the flag when the run ends (natural or aborted). */
export function unregisterRun(projectId: string): void {
  controlUnregister(projectId);
}
