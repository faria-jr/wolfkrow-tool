/**
 * Fastify server factory
 *
 * Creates a configured Fastify instance with plugins and routes.
 */

import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import Fastify from 'fastify';

import { config } from './config';
import { createLogger } from './logger';
import { authPlugin } from './plugins/auth';
import { chatRoutes } from './routes/chat';
import { healthRoutes } from './routes/health';
import { knowledgeRoutes } from './routes/knowledge';
import { memoryRoutes } from './routes/memory';
import { mcpRoutes } from './routes/mcp';
import { harnessRoutes } from './routes/harness';
import { enrichRoutes } from './routes/enrich';
import { voiceRoutes } from './routes/voice';
import { pipelineRoutes } from './routes/pipeline';
import { schedulerRoutes } from './routes/scheduler';
import { ptyRoutes } from './routes/pty';
import { telegramRoutes } from './routes/telegram';
import { vaultRoutes } from './routes/vault';
import { usageRoutes } from './routes/usage';
import { logsRoutes } from './routes/logs';
import { rulesRoutes } from './routes/rules';
import { permissionsRoutes } from './routes/permissions';
import { tasksRoutes } from './routes/tasks';
import { graphRoutes } from './routes/graph';

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
  await server.register(multipart, { limits: { fileSize: 50 * 1024 * 1024 } });

  await server.register(healthRoutes, { prefix: '/health' });
  await server.register(knowledgeRoutes, { prefix: '/api' });
  await server.register(memoryRoutes, { prefix: '/api' });
  await server.register(schedulerRoutes, { prefix: '/scheduler' });
  await server.register(harnessRoutes, { prefix: '/harness' });
  await server.register(pipelineRoutes, { prefix: '/pipeline' });
  await server.register(enrichRoutes, { prefix: '/enrich' });
  await server.register(voiceRoutes, { prefix: '/voice' });
  await server.register(chatRoutes, { prefix: '/chat' });
  await server.register(mcpRoutes, { prefix: '/mcp' });
  await server.register(ptyRoutes);
  await server.register(telegramRoutes, { prefix: '/telegram' });
  await server.register(vaultRoutes, { prefix: '/vault' });
  await server.register(usageRoutes, { prefix: '/usage' });
  await server.register(logsRoutes, { prefix: '/logs' });
  await server.register(rulesRoutes, { prefix: '/rules' });
  await server.register(permissionsRoutes, { prefix: '/permissions' });
  await server.register(tasksRoutes, { prefix: '/tasks' });
  await server.register(graphRoutes, { prefix: '/graph' });

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
