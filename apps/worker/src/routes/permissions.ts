/**
 * Permissions + Audit routes — S.3.
 */


import {
  ResolvePermissionUseCase,
  RecordAuditEntryUseCase,
  QueryAuditLogUseCase,
} from '@wolfkrow/use-cases';
import { z } from 'zod';

import { clearDecision, recordDecision } from '../chat/permission-store';
import { getRepos } from '../container';
import type { AuthFastifyInstance } from '../types/fastify';
import { validate } from '../validation';

const resolveBody = z.object({
  tool: z.string().min(1).max(128),
  allowedTools: z.array(z.string().max(128)).max(200).default([]),
  blockedTools: z.array(z.string().max(128)).max(200).optional(),
});

const recordBody = z.object({
  action: z.string().min(1).max(128),
  resourceType: z.string().min(1).max(64),
  resourceId: z.string().max(128).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const auditQuery = z.object({
  action: z.string().max(128).optional(),
  resourceType: z.string().max(64).optional(),
  since: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(50),
});

/** Decision-management request schemas (P2-1, backed by P1-7 persistence). */
const decisionsQuery = z.object({
  agentId: z.string().max(128).optional(),
});

const decisionBody = z.object({
  agentId: z.string().min(1).max(128),
  tool: z.string().min(1).max(128),
  decision: z.enum(['allow', 'deny']),
});

const decisionDeleteBody = z.object({
  agentId: z.string().min(1).max(128),
  tool: z.string().min(1).max(128),
});

function getUserId(req: { user?: { userId?: string } }): string {
  // Auth is enforced via onRequest: [server.authenticate] on every route in
  // this plugin, so req.user.userId is always populated by the auth plugin on
  // a valid JWT. The 'default' fallback is purely defensive (it should never
  // be reached when auth is active); it does NOT represent a real shared
  // namespace.
  return req.user?.userId ?? 'default';
}

/**
 * Management endpoints (P2-1) — expose the durable tool-permission decisions
 * (P1-7) so the web UI can list/set/reset them. Writes go through the
 * permission-store so the in-memory cache stays coherent with the DB.
 */
function registerDecisionRoutes(server: AuthFastifyInstance): void {
  // All decision endpoints are a writable security-decision surface (set
  // allow/deny per agent/tool). Authentication is mandatory so decisions are
  // scoped to the authenticated user — matches sibling routes (logs.ts P0-7,
  // knowledge.ts, graph.ts, memory.ts).
  const auth = { onRequest: [server.authenticate] };

  // GET /permissions/decisions — list durable decisions for the authenticated
  // user (optionally scoped to one agent). Tools with no row are "ask".
  server.get<{ Querystring: unknown }>('/decisions', auth, async (req, reply) => {
    const userId = getUserId(req as { user?: { userId?: string } });
    const { agentId } = validate(decisionsQuery, req.query);
    const decisions = getRepos().toolPermission.listForUser(userId, agentId);
    return reply.send({ decisions });
  });

  // PUT /permissions/decisions — upsert an allow/deny decision. Warms the
  // in-memory cache so the next tool call is answered without re-asking.
  server.put<{ Body: unknown }>('/decisions', auth, async (req, reply) => {
    const userId = getUserId(req as { user?: { userId?: string } });
    const { agentId, tool, decision } = validate(decisionBody, req.body);
    recordDecision(userId, agentId, tool, decision);
    return reply.send({ ok: true });
  });

  // DELETE /permissions/decisions — remove a stored decision, resetting the
  // tool to "ask" (no stored decision → runtime asks the user again).
  server.delete<{ Body: unknown }>('/decisions', auth, async (req, reply) => {
    const userId = getUserId(req as { user?: { userId?: string } });
    const { agentId, tool } = validate(decisionDeleteBody, req.body);
    clearDecision(userId, agentId, tool);
    return reply.send({ ok: true });
  });
}

export async function permissionsRoutes(server: AuthFastifyInstance) {
  const auditRepo = getRepos().auditLog;
  const resolveUC = new ResolvePermissionUseCase();
  const recordUC = new RecordAuditEntryUseCase(auditRepo);
  const queryUC = new QueryAuditLogUseCase(auditRepo);

  // All permission/audit endpoints require authentication. Without it,
  // getUserId would resolve every unauthenticated request to the shared
  // 'default' user, co-mingling all users' audit logs and permission
  // decisions — a cross-user data-integrity + security hole (P2-1 fix,
  // same class of bug as P0-7 logs auth). Matches sibling routes:
  // logs.ts P0-7, knowledge.ts, graph.ts, memory.ts.
  const auth = { onRequest: [server.authenticate] };

  // POST /permissions/resolve — check if a tool is allowed
  server.post<{ Body: unknown }>('/resolve', auth, async (req, reply) => {
    const { tool, allowedTools, blockedTools } = validate(resolveBody, req.body);
    const result = resolveUC.execute({
      agent: { allowedTools, ...(blockedTools ? { blockedTools } : {}) },
      tool,
    });
    return reply.send(result);
  });

  registerDecisionRoutes(server);

  // POST /permissions/audit — record audit entry
  server.post<{ Body: unknown }>('/audit', auth, async (req, reply) => {
    const userId = getUserId(req as { user?: { userId?: string } });
    const parsed = validate(recordBody, req.body);
    recordUC.execute({
      userId,
      action: parsed.action,
      resourceType: parsed.resourceType,
      ip: req.ip,
      ...(parsed.resourceId !== undefined ? { resourceId: parsed.resourceId } : {}),
      ...(parsed.metadata !== undefined ? { metadata: parsed.metadata } : {}),
    });
    return reply.send({ ok: true });
  });

  // GET /permissions/audit — query audit log
  server.get<{ Querystring: unknown }>('/audit', auth, async (req, reply) => {
    const userId = getUserId(req as { user?: { userId?: string } });
    const { action, resourceType, since, limit } = validate(auditQuery, req.query);
    const entries = queryUC.execute({
      userId,
      ...(action ? { action } : {}),
      ...(resourceType ? { resourceType } : {}),
      ...(since ? { since: new Date(since) } : {}),
      limit,
    });
    return reply.send({ entries });
  });
}
