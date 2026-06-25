/**
 * Tool-permission store — two concerns in one module:
 *
 * 1. PENDING requests (in-memory only): when ClaudeAgentProvider hits a
 *    destructive tool (PermissionResult 'ask'), `requestToolPermission` parks
 *    a Promise the UI must resolve via POST /chat/permission. Single worker
 *    process; TTL 5 min — auto-denies if the UI does not respond in time.
 *
 * 2. DURABLE decisions (DB-backed + in-memory cache): once the UI approves or
 *    denies a tool, `recordDecision` upserts it to the DB and warms the cache.
 *    `getDecision` checks the cache first (no DB read) so a repeated tool call
 *    is answered instantly without re-prompting the user. On worker startup
 *    `loadDecisionsFromDb` repopulates the cache, so a restart does NOT
 *    re-ask tools the user already approved (P1-7 / Bug #3).
 *
 * Decisions are scoped per (userId, agentId, tool) — one user's approvals
 * never leak to another.
 */

import {
  DrizzleToolPermissionRepo,
  decisionKey,
  type ToolPermissionDecision,
} from '@wolfkrow/infra/repos';
import { createLogger } from '../logger';

const logger = createLogger('permission-store');

const TTL_MS = 5 * 60 * 1_000;

type Resolver = (approved: boolean) => void;

interface PendingEntry {
  resolver: Resolver;
  timer: ReturnType<typeof setTimeout>;
  /** Context captured at park time so a UI decision can be persisted. */
  userId: string;
  agentId: string;
  tool: string;
}

/* ------------------------------------------------------------------ */
/* Pending requests (in-memory)                                       */
/* ------------------------------------------------------------------ */

const pending = new Map<string, PendingEntry>();

/**
 * Park a permission request; resolves once the UI POSTs a decision or TTL
 * expires. The (userId, agentId, tool) context is captured so that when the
 * UI responds we can persist the decision durably.
 */
export function requestToolPermission(
  callId: string,
  ctx: { userId: string; agentId: string; tool: string },
): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const timer = setTimeout(() => {
      if (pending.has(callId)) {
        pending.delete(callId);
        resolve(false);
      }
    }, TTL_MS);
    pending.set(callId, { resolver: resolve, timer, ...ctx });
  });
}

/**
 * Apply the UI decision. Persists it to the DB (durable) + cache, then resolves
 * the parked Promise. Returns false if the callId is unknown/expired.
 */
export function resolveToolPermission(callId: string, approved: boolean): boolean {
  const entry = pending.get(callId);
  if (!entry) return false;
  clearTimeout(entry.timer);
  pending.delete(callId);

  // Persist the decision so a restart does not re-ask the same tool.
  recordDecision(entry.userId, entry.agentId, entry.tool, approved ? 'allow' : 'deny');

  entry.resolver(approved);
  return true;
}

export function hasPendingPermission(callId: string): boolean {
  return pending.has(callId);
}

/** Drain all pending permissions on shutdown — resolves all with denied. */
export function clearAllPendingPermissions(): void {
  for (const [, entry] of pending) {
    clearTimeout(entry.timer);
    entry.resolver(false);
  }
  pending.clear();
}

/* ------------------------------------------------------------------ */
/* Durable decisions (DB-backed + in-memory cache)                    */
/* ------------------------------------------------------------------ */

/**
 * In-memory cache of durable decisions. Key = decisionKey(userId, agentId, tool).
 * Warmed at startup by `loadDecisionsFromDb`; updated on every `recordDecision`.
 */
let decisionCache = new Map<string, ToolPermissionDecision>();

/**
 * Repository handle. Lazily resolved so the module remains import-safe before
 * the DB is initialized (e.g. in unit tests that only exercise pending flow).
 */
let _repo: DrizzleToolPermissionRepo | null = null;

function repo(): DrizzleToolPermissionRepo | null {
  if (_repo) return _repo;
  // Lazily construct; getDb() may throw before the worker boots the DB.
  try {
    _repo = new DrizzleToolPermissionRepo();
    return _repo;
  } catch {
    return null;
  }
}

/**
 * Read a prior decision from the cache (no DB read — cache is the source of
 * truth at runtime). Returns null if the user has never decided for this tool.
 */
export function getDecision(
  userId: string,
  agentId: string,
  tool: string,
): ToolPermissionDecision | null {
  return decisionCache.get(decisionKey(userId, agentId, tool)) ?? null;
}

/**
 * Persist a decision to the DB (upsert) AND warm the cache. Safe to call
 * even if the DB is unavailable — the cache is still updated so the current
 * process benefits; persistence is best-effort on the write path.
 */
export function recordDecision(
  userId: string,
  agentId: string,
  tool: string,
  decision: ToolPermissionDecision,
): void {
  decisionCache.set(decisionKey(userId, agentId, tool), decision);
  const r = repo();
  if (!r) return;
  try {
    r.upsert({ userId, agentId, tool, decision });
  } catch (err) {
    // Cache is the runtime source of truth; a failed write is non-fatal.
    logger.error({ err, userId, agentId, tool }, 'permission decision DB write failed');
  }
}

/**
 * Warm the decision cache from the DB. Called once at worker startup so a
 * restart restores all prior approvals. Safe to call when the DB is empty
 * (yields an empty cache) — mirrors the `seedAgentsForExistingUsers` pattern.
 */
export function loadDecisionsFromDb(): void {
  const r = repo();
  if (!r) return;
  try {
    decisionCache = r.loadAll();
  } catch (err) {
    // Leave the existing (empty) cache — non-fatal at startup.
    logger.error({ err }, 'permission decisions DB load failed — cache left empty');
  }
}

/**
 * Test-only escape hatch: reset both the pending map and the decision cache
 * to a clean state, and drop the repo handle so the next access re-resolves
 * against the current DB singleton.
 */
export function _resetForTesting(): void {
  clearAllPendingPermissions();
  decisionCache = new Map<string, ToolPermissionDecision>();
  _repo = null;
}
