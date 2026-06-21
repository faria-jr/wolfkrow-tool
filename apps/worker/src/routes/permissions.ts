/**
 * Permissions + Audit routes — S.3.
 */

import { DrizzleAuditLogRepo } from '@wolfkrow/infra/repos';
import {
  ResolvePermissionUseCase,
  RecordAuditEntryUseCase,
  QueryAuditLogUseCase,
} from '@wolfkrow/use-cases';

import type { AuthFastifyInstance } from '../types/fastify';

function getUserId(req: { user?: { userId?: string } }): string {
  return req.user?.userId ?? 'default';
}

export async function permissionsRoutes(server: AuthFastifyInstance) {
  const auditRepo = new DrizzleAuditLogRepo();
  const resolveUC = new ResolvePermissionUseCase();
  const recordUC = new RecordAuditEntryUseCase(auditRepo as never);
  const queryUC = new QueryAuditLogUseCase(auditRepo as never);

  type ResolveBody = { tool: string; allowedTools?: string[]; blockedTools?: string[] };
  type RecordBody = { action: string; resourceType: string; resourceId?: string; metadata?: Record<string, unknown> };
  type AuditQuery = { action?: string; resourceType?: string; since?: string; limit?: string };

  // POST /permissions/resolve — check if a tool is allowed
  server.post<{ Body: ResolveBody }>('/resolve', async (req, reply) => {
    const { tool, allowedTools = [], blockedTools } = req.body;
    const result = resolveUC.execute({
      agent: { allowedTools, ...(blockedTools ? { blockedTools } : {}) },
      tool,
    });
    return reply.send(result);
  });

  // POST /permissions/audit — record audit entry
  server.post<{ Body: RecordBody }>('/audit', async (req, reply) => {
    const userId = getUserId(req as { user?: { userId?: string } });
    recordUC.execute({
      userId,
      ...req.body,
      ip: req.ip,
    });
    return reply.send({ ok: true });
  });

  // GET /permissions/audit — query audit log
  server.get<{ Querystring: AuditQuery }>('/audit', async (req, reply) => {
    const userId = getUserId(req as { user?: { userId?: string } });
    const entries = queryUC.execute({
      userId,
      ...(req.query.action ? { action: req.query.action } : {}),
      ...(req.query.resourceType ? { resourceType: req.query.resourceType } : {}),
      ...(req.query.since ? { since: new Date(req.query.since) } : {}),
      ...(req.query.limit ? { limit: Number(req.query.limit) } : {}),
    });
    return reply.send({ entries });
  });
}
