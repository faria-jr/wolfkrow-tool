/**
 * Sidecar lifecycle routes — S.6
 *
 * POST /sidecar/start   — start the sidecar process
 * POST /sidecar/stop    — stop it
 * GET  /sidecar/status  — current state
 */

import { sidecarManager } from '../sidecar/manager';
import type { AuthFastifyInstance } from '../types/fastify';

export async function sidecarRoutes(server: AuthFastifyInstance) {
  const auth = { preHandler: [server.authenticate] };

  server.post('/start', auth, async (_req, reply) => {
    sidecarManager.start();
    return reply.send({ ok: true, state: sidecarManager.getState() });
  });

  server.post('/stop', auth, async (_req, reply) => {
    sidecarManager.stop();
    return reply.send({ ok: true });
  });

  server.get('/status', auth, async (_req, reply) => {
    return reply.send({ state: sidecarManager.getState() });
  });
}
