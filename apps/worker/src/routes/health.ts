/**
 * Health check routes
 */

import type { FastifyInstance } from 'fastify';

export async function healthRoutes(server: FastifyInstance) {
  server.get('/', async () => {
    return {
      status: 'ok',
      service: 'wolfkrow-worker',
      timestamp: new Date().toISOString(),
    };
  });
}
