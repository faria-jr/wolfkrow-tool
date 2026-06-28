/**
 * Human-question store — generic ask-user round-trip for the chat / harness /
 * pipeline loops.
 *
 * When a run needs a free-form answer from the user (not a tool
 * allow/deny — that's the permission store), `requestHumanQuestion` parks a
 * Promise the UI must resolve via POST /chat/human-question. Single worker
 * process; TTL 5 min — resolves with a sentinel 'no answer' if the UI does not
 * respond in time so the run does not hang forever.
 *
 * Mirrors the pending-request half of permission-store.ts.
 */

const TTL_MS = 5 * 60 * 1_000;

export interface HumanQuestionInput {
  question: string;
  options?: readonly string[];
}

export interface PendingHumanQuestion extends HumanQuestionInput {
  questionId: string;
}

interface PendingEntry {
  resolver: (answer: string) => void;
  timer: ReturnType<typeof setTimeout>;
}

const pending = new Map<string, PendingEntry>();

/**
 * Park a human question; resolves once the UI POSTs an answer or TTL expires.
 * The caller emits the question as an SSE event before/while awaiting this.
 */
export function requestHumanQuestion(questionId: string, input: HumanQuestionInput): Promise<string> {
  return new Promise<string>((resolve) => {
    const timer = setTimeout(() => {
      if (pending.has(questionId)) {
        pending.delete(questionId);
        resolve('');
      }
    }, TTL_MS);
    pending.set(questionId, { resolver: resolve, timer });
    // Reference input so it is part of the closure contract; the caller holds
    // the question text for the SSE emit. Suppress unused-var lint.
    void input;
  });
}

/**
 * Apply the UI answer and resolve the parked Promise. Returns false if the
 * questionId is unknown/expired.
 */
export function resolveHumanQuestion(questionId: string, answer: string): boolean {
  const entry = pending.get(questionId);
  if (!entry) return false;
  clearTimeout(entry.timer);
  pending.delete(questionId);
  entry.resolver(answer);
  return true;
}

export function hasPendingHumanQuestion(questionId: string): boolean {
  return pending.has(questionId);
}

/** Drain all pending questions on shutdown — resolves all with empty answers. */
export function clearAllPendingHumanQuestions(): void {
  for (const [, entry] of pending) {
    clearTimeout(entry.timer);
    entry.resolver('');
  }
  pending.clear();
}
