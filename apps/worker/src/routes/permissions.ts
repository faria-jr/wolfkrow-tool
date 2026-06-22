/**
 * Permissions + Audit routes — S.3.
 */


import {
  ResolvePermissionUseCase,
  RecordAuditEntryUseCase,
  QueryAuditLogUseCase,
} from '@wolfkrow/use-cases';
import { z } from 'zod';

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

function getUserId(req: { user?: { userId?: string } }): string {
  return req.user?.userId ?? 'default';
}

export async function permissionsRoutes(server: AuthFastifyInstance) {
  const auditRepo = getRepos().auditLog;
  const resolveUC = new ResolvePermissionUseCase();
  const recordUC = new RecordAuditEntryUseCase(auditRepo);
  const queryUC = new QueryAuditLogUseCase(auditRepo);

  // POST /permissions/resolve — check if a tool is allowed
  server.post<{ Body: unknown }>('/resolve', async (req, reply) => {
    const { tool, allowedTools, blockedTools } = validate(resolveBody, req.body);
    const result = resolveUC.execute({
      agent: { allowedTools, ...(blockedTools ? { blockedTools } : {}) },
      tool,
    });
    return reply.send(result);
  });

  // POST /permissions/audit — record audit entry
  server.post<{ Body: unknown }>('/audit', async (req, reply) => {
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
  server.get<{ Querystring: unknown }>('/audit', async (req, reply) => {
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
