/**
 * Fastify server factory
 *
 * Creates a configured Fastify instance with plugins and routes.
 */

import cors from '@fastify/cors';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import Fastify from 'fastify';

import { config } from './config';
import { createLogger } from './logger';
import { authPlugin } from './plugins/auth';
import { chatRoutes } from './routes/chat';
import { healthRoutes } from './routes/health';
import { mcpRoutes } from './routes/mcp';
import { schedulerRoutes } from './routes/scheduler';

export async function createServer() {
  const logger = createLogger('server');

  const server = Fastify({
    loggerInstance: logger,
    trustProxy: true,
  });

  await server.register(cors, {
    origin: config.NODE_ENV === 'development' ? true : ['http://localhost:3000'],
    credentials: true,
  });

  await server.register(swagger, {
    openapi: {
      info: {
        title: 'Wolfkrow Worker API',
        description: 'Background worker API for Wolfkrow',
        version: '1.0.0',
      },
      servers: [{ url: `http://${config.HOST}:${config.PORT}` }],
    },
  });

  await server.register(swaggerUi, {
    routePrefix: '/docs',
  });

  await server.register(authPlugin);

  await server.register(healthRoutes, { prefix: '/health' });
  await server.register(schedulerRoutes, { prefix: '/scheduler' });
  await server.register(chatRoutes, { prefix: '/chat' });
  await server.register(mcpRoutes, { prefix: '/mcp' });

  server.setErrorHandler((error, request, reply) => {
    const err = error as Error & { statusCode?: number; code?: string };
    logger.error({ err, reqId: request.id }, 'Request error');
    reply.status(err.statusCode ?? 500).send({
      error: err.message,
      code: err.code ?? 'INTERNAL_ERROR',
    });
  });

  return server;
}
