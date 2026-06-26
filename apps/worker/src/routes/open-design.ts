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
 * Like sidecar, lifecycle is a privileged global op (no per-user data) — auth
 * hardening tracked alongside sidecar.
 */

import type { FastifyReply, FastifyRequest } from 'fastify';

import { bootstrapDesignSession } from '../open-design/bootstrap';
import { OpenDesignClient } from '../open-design/client';
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

/** Returns the daemon client + web URL, or sends 409 when the engine isn't up. */
async function resolveEngine(reply: FastifyReply): Promise<{ client: OpenDesignClient; webUrl: string } | null> {
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
  return result;
}

async function snapshotHandler(req: FastifyRequest, reply: FastifyReply) {
  const engine = await resolveEngine(reply);
  if (!engine) return;
  const body = validate(snapshotBody, req.body);
  return captureDesignArtifact(engine.client, body.odProjectId);
}

export async function openDesignRoutes(server: AuthFastifyInstance) {
  server.post('/start', async (_req, reply) => {
    openDesignManager.start();
    return reply.send({ ok: true, state: openDesignManager.getState() });
  });

  server.post('/stop', async (_req, reply) => {
    openDesignManager.stop();
    return reply.send({ ok: true });
  });

  server.get('/status', async (_req, reply) => {
    return reply.send({ state: openDesignManager.getState() });
  });

  server.post('/bootstrap', bootstrapHandler);
  server.post('/snapshot', snapshotHandler);
}
