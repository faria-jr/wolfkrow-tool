/**
 * Log streaming routes — SSE live tail. S.3.
 */

import { z } from 'zod';

import type { AuthFastifyInstance } from '../types/fastify';
import { logBus } from '../log/bus';
import type { LogEntry } from '../log/bus';
import { validate } from '../validation';

const logQuery = z.object({
  level: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).optional(),
  module: z.string().max(64).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});

const streamQuery = z.object({
  level: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).optional(),
  module: z.string().max(64).optional(),
});

export async function logsRoutes(server: AuthFastifyInstance) {
  // GET /logs/history?limit=&level=&module=
  server.get<{ Querystring: unknown }>(
    '/history',
    async (req, reply) => {
      const { level, module: mod, limit } = validate(logQuery, req.query);
      let entries = logBus.history(limit);

      if (level) entries = entries.filter((e) => e.level?.toString().toLowerCase() === level);
      if (mod) entries = entries.filter((e) => e.module?.toString().toLowerCase().includes(mod));

      return reply.send({ entries });
    },
  );

  // GET /logs/stream — SSE live tail
  server.get<{ Querystring: unknown }>(
    '/stream',
    async (req, reply) => {
      const { level: levelFilter, module: moduleFilter } = validate(streamQuery, req.query);

      reply.raw.setHeader('Content-Type', 'text/event-stream');
      reply.raw.setHeader('Cache-Control', 'no-cache');
      reply.raw.setHeader('Connection', 'keep-alive');
      reply.raw.flushHeaders?.();

      function send(entry: LogEntry) {
        if (levelFilter && entry.level?.toString().toLowerCase() !== levelFilter) return;
        if (moduleFilter && !entry.module?.toString().toLowerCase().includes(moduleFilter)) return;
        reply.raw.write(`data: ${JSON.stringify(entry)}\n\n`);
      }

      for (const entry of logBus.history(50)) send(entry);

      const unsub = logBus.subscribe(send);
      req.raw.on('close', unsub);
      req.raw.on('end', unsub);
    },
  );
}
