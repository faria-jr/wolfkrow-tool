/**
 * T17 (tech_debt): in-process store of pending tool-permission requests.
 *
 * When ClaudeAgentProvider hits a destructive tool (PermissionResult 'ask'), it
 * calls requestPermission → here we park a Promise the UI must resolve via
 * POST /chat/permission. Single worker process; requests live only in memory.
 */

type Resolver = (approved: boolean) => void;

const pending = new Map<string, Resolver>();

/** Park a permission request; resolves once the UI POSTs a decision. */
export function requestToolPermission(callId: string): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    pending.set(callId, resolve);
  });
}

/** Apply the UI decision; returns false if the callId is unknown/expired. */
export function resolveToolPermission(callId: string, approved: boolean): boolean {
  const resolver = pending.get(callId);
  if (!resolver) return false;
  pending.delete(callId);
  resolver(approved);
  return true;
}

export function hasPendingPermission(callId: string): boolean {
  return pending.has(callId);
}
