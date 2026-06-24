/**
 * T17 (tech_debt): in-process store of pending tool-permission requests.
 *
 * When ClaudeAgentProvider hits a destructive tool (PermissionResult 'ask'), it
 * calls requestPermission → here we park a Promise the UI must resolve via
 * POST /chat/permission. Single worker process; requests live only in memory.
 *
 * M7.6: TTL of 5 minutes — auto-denies if UI does not respond in time.
 */

const TTL_MS = 5 * 60 * 1_000;

type Resolver = (approved: boolean) => void;

interface PendingEntry {
  resolver: Resolver;
  timer: ReturnType<typeof setTimeout>;
}

const pending = new Map<string, PendingEntry>();

/** Park a permission request; resolves once the UI POSTs a decision or TTL expires. */
export function requestToolPermission(callId: string): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const timer = setTimeout(() => {
      if (pending.has(callId)) {
        pending.delete(callId);
        resolve(false);
      }
    }, TTL_MS);
    pending.set(callId, { resolver: resolve, timer });
  });
}

/** Apply the UI decision; returns false if the callId is unknown/expired. */
export function resolveToolPermission(callId: string, approved: boolean): boolean {
  const entry = pending.get(callId);
  if (!entry) return false;
  clearTimeout(entry.timer);
  pending.delete(callId);
  entry.resolver(approved);
  return true;
}

export function hasPendingPermission(callId: string): boolean {
  return pending.has(callId);
}

/** Drain all pending permissions on shutdown — resolves all with denied. */
export function clearAllPendingPermissions(): void {
  for (const [callId, entry] of pending) {
    clearTimeout(entry.timer);
    entry.resolver(false);
    pending.delete(callId);
  }
}
