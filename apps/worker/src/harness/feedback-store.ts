/**
 * In-process feature-feedback store for the Harness HITL chat.
 *
 * The operator can send guidance while a sprint runs (e.g. "focus on the error
 * handling"). The feedback is parked here keyed by feature index and drained
 * into the coder's `previousFeedback` on its next round, so the operator's
 * guidance actually steers the run — a real feedback loop, not a UI mock.
 *
 * In-memory + per-process; adequate for the single-worker deployment. Feedback
 * older than TTL is ignored (best-effort; the coder only reads current round).
 */

const TTL_MS = 30 * 60 * 1_000;

interface FeedbackEntry {
  text: string;
  at: number;
}

/** featureKey = `${projectId}::${featureIndex}` */
const store = new Map<string, FeedbackEntry>();

/** Record operator feedback for a feature (appends to any pending feedback). */
export function recordFeedback(projectId: string, featureIndex: number, text: string): void {
  const key = `${projectId}::${featureIndex}`;
  const existing = store.get(key);
  const combined = existing ? `${existing.text}\n${text}` : text;
  store.set(key, { text: combined, at: Date.now() });
}

/** Drain (read + clear) pending feedback for a feature. Returns '' if none/expired. */
export function drainFeedback(projectId: string, featureIndex: number): string {
  const key = `${projectId}::${featureIndex}`;
  const entry = store.get(key);
  if (!entry) return '';
  store.delete(key);
  if (Date.now() - entry.at > TTL_MS) return '';
  return entry.text;
}

/** Test helper: clear all stored feedback. */
export function clearFeedback(): void {
  store.clear();
}
