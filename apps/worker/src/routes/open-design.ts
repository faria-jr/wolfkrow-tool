/**
 * EPIC 4.2b — Open Design engine lifecycle routes.
 *
 * POST /open-design/start   — spawn the engine (daemon + web via tools-dev)
 * POST /open-design/stop    — stop it
 * GET  /open-design/status  — current state (includes webUrl for iframe +
 *                             daemonUrl for the OpenDesignClient)
 *
 * Mirrors sidecar.ts. Like sidecar, this is a privileged global op (spawns a
 * local process; no per-user data) — auth hardening tracked alongside sidecar.
 */

import { openDesignManager } from '../open-design/manager';
import type { AuthFastifyInstance } from '../types/fastify';

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
}
