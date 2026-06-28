/**
 * EPIC 4.2 — Open Design engine routes.
 *
 * Lifecycle:
 *   POST /open-design/start   — spawn the engine (daemon + web via tools-dev)
 *   POST /open-design/stop    — stop it
 *   GET  /open-design/status  — state (webUrl for iframe + daemonUrl for client)
 *
 * Session (4.2c):
 *   POST /open-design/bootstrap — create an OD project tied to a Wolfkrow
 *                                 project + seed the design-brief prompt
 *   POST /open-design/snapshot  — capture the design HTML artifact
 *
 * All lifecycle + session routes are privileged operations that spawn/stop
 * processes and write to the filesystem, so every route requires an
 * authenticated session. The actor is recorded via the worker audit log.
 */

import { RecordAuditEntryUseCase } from '@wolfkrow/use-cases';
import type { FastifyReply, FastifyRequest } from 'fastify';

import { getRepos } from '../container';
import { validateProjectPath } from '../lib/project-path';
import { bootstrapDesignSession } from '../open-design/bootstrap';
import { OpenDesignClient } from '../open-design/client';
import { lockDesign } from '../open-design/lock';
import { openDesignManager } from '../open-design/manager';
import { captureDesignArtifact } from '../open-design/snapshot';
import type { AuthFastifyInstance } from '../types/fastify';
import { validate, z } from '../validation';

const bootstrapBody = z.object({
  wolfkrowProjectId: z.string().min(1).max(128),
  name: z.string().min(1).max(256),
  specContent: z.string().max(200_000).optional(),
  designSystemId: z.string().max(128).optional(),
});

const snapshotBody = z.object({ odProjectId: z.string().min(1).max(128) });

const lockBody = z.object({
  odProjectId: z.string().min(1).max(128),
  outputDir: z.string().min(1).max(4096),
});

function actorId(req: FastifyRequest): string {
  return req.user?.userId ?? 'unknown';
}

/** Records an open-design lifecycle event in the audit log (best-effort). */
function auditOpenDesign(
  req: FastifyRequest,
  action: string,
  resourceId?: string,
  metadata?: Record<string, unknown>
): void {
  try {
    const repo = getRepos().auditLog;
    new RecordAuditEntryUseCase(repo).execute({
      userId: actorId(req),
      action,
      resourceType: 'open-design',
      ...(resourceId !== undefined ? { resourceId } : {}),
      metadata: metadata ?? {},
    });
  } catch {
    // Audit must never break the lifecycle op itself.
  }
}

/** Returns the daemon client + web URL, or sends 409 when the engine isn't up. */
async function resolveEngine(
  reply: FastifyReply
): Promise<{ client: OpenDesignClient; webUrl: string } | null> {
  const { daemonUrl, webUrl, status } = openDesignManager.getState();
  if (status !== 'running' || !daemonUrl || !webUrl) {
    reply.status(409).send({ error: 'Open Design engine is not running' });
    return null;
  }
  return { client: new OpenDesignClient(daemonUrl), webUrl };
}

async function bootstrapHandler(req: FastifyRequest, reply: FastifyReply) {
  const engine = await resolveEngine(reply);
  if (!engine) return;
  const body = validate(bootstrapBody, req.body);
  const result = await bootstrapDesignSession(engine.client, {
    wolfkrowProjectId: body.wolfkrowProjectId,
    name: body.name,
    specContent: body.specContent ?? '',
    webUrl: engine.webUrl,
    ...(body.designSystemId !== undefined ? { designSystemId: body.designSystemId } : {}),
  });
  auditOpenDesign(req, 'bootstrap', body.wolfkrowProjectId, { name: body.name });
  return result;
}

async function snapshotHandler(req: FastifyRequest, reply: FastifyReply) {
  const engine = await resolveEngine(reply);
  if (!engine) return;
  const body = validate(snapshotBody, req.body);
  const result = captureDesignArtifact(engine.client, body.odProjectId);
  auditOpenDesign(req, 'snapshot', body.odProjectId);
  return result;
}

async function lockHandler(req: FastifyRequest, reply: FastifyReply) {
  const engine = await resolveEngine(reply);
  if (!engine) return;
  const body = validate(lockBody, req.body);
  const checkedDir = validateProjectPath(body.outputDir);
  if (!checkedDir.ok) {
    return reply.status(422).send({ error: checkedDir.reason });
  }
  const result = await lockDesign({
    client: engine.client,
    odProjectId: body.odProjectId,
    outputDir: checkedDir.path,
  });
  auditOpenDesign(req, 'lock', body.odProjectId, { outputDir: checkedDir.path });
  return result;
}

export async function openDesignRoutes(server: AuthFastifyInstance) {
  // Every route spawns/stops a process or writes to the filesystem, so all
  // require an authenticated session. The actor is recorded via audit log.
  const auth = { onRequest: [server.authenticate] };

  server.post('/start', auth, async (req, reply) => {
    openDesignManager.start();
    auditOpenDesign(req, 'start');
    return reply.send({ ok: true, state: openDesignManager.getState() });
  });

  server.post('/stop', auth, async (req, reply) => {
    openDesignManager.stop();
    auditOpenDesign(req, 'stop');
    return reply.send({ ok: true });
  });

  server.get('/status', auth, async (_req, reply) => {
    return reply.send({ state: openDesignManager.getState() });
  });

  server.post('/bootstrap', auth, bootstrapHandler);
  server.post('/snapshot', auth, snapshotHandler);
  server.post('/lock', auth, lockHandler);
}
