/**
 * Log streaming routes — SSE live tail. S.3.
 */

import type { AuthFastifyInstance } from '../types/fastify';
import { logBus } from '../log/bus';
import type { LogEntry } from '../log/bus';

export async function logsRoutes(server: AuthFastifyInstance) {
  // GET /logs/history?limit=100 — recent log entries
  server.get<{ Querystring: { limit?: string; level?: string; module?: string } }>(
    '/history',
    async (req, reply) => {
      const limit = Number(req.query.limit ?? 100);
      let entries = logBus.history(Math.min(limit, 500));

      if (req.query.level) {
        const lvl = req.query.level.toLowerCase();
        entries = entries.filter((e) => e.level?.toString().toLowerCase() === lvl);
      }
      if (req.query.module) {
        const mod = req.query.module.toLowerCase();
        entries = entries.filter((e) => e.module?.toString().toLowerCase().includes(mod));
      }

      return reply.send({ entries });
    },
  );

  // GET /logs/stream — SSE live tail
  server.get<{ Querystring: { level?: string; module?: string } }>(
    '/stream',
    async (req, reply) => {
      reply.raw.setHeader('Content-Type', 'text/event-stream');
      reply.raw.setHeader('Cache-Control', 'no-cache');
      reply.raw.setHeader('Connection', 'keep-alive');
      reply.raw.flushHeaders?.();

      const levelFilter = req.query.level?.toLowerCase();
      const moduleFilter = req.query.module?.toLowerCase();

      function send(entry: LogEntry) {
        if (levelFilter && entry.level?.toString().toLowerCase() !== levelFilter) return;
        if (moduleFilter && !entry.module?.toString().toLowerCase().includes(moduleFilter)) return;
        reply.raw.write(`data: ${JSON.stringify(entry)}\n\n`);
      }

      // Send recent history first
      for (const entry of logBus.history(50)) send(entry);

      const unsub = logBus.subscribe(send);
      req.raw.on('close', unsub);
      req.raw.on('end', unsub);
    },
  );
}
