/**
 * PTY WebSocket route — B.5 CodeBurn terminal.
 *
 * Protocol messages (JSON):
 *   client → server: { type: 'input', data: string }
 *                    { type: 'resize', cols: number, rows: number }
 *                    { type: 'kill' }
 *   server → client: { type: 'output', data: string }
 *                    { type: 'exit', code: number }
 */

import websocket from '@fastify/websocket';
import { randomUUID } from 'crypto';
import { z } from 'zod';

import type { FastifyInstance } from 'fastify';
import { ptyServer } from '../pty/server';
import { validate } from '../validation';

type ClientMsg =
  | { type: 'input'; data: string }
  | { type: 'resize'; cols: number; rows: number }
  | { type: 'kill' };

const createBody = z.object({
  id: z.string().min(1).max(64).optional(),
  cols: z.coerce.number().int().min(10).max(500).default(80),
  rows: z.coerce.number().int().min(5).max(200).default(24),
  cwd: z.string().max(1024).optional(),
  env: z.record(z.string(), z.string()).optional(),
});

export async function ptyRoutes(server: FastifyInstance) {
  await server.register(websocket);

  // POST /pty — create session, returns { sessionId }
  server.post<{ Body: unknown }>('/pty', async (req, reply) => {
    const parsed = validate(createBody, req.body ?? {});
    const sessionId = parsed.id ?? randomUUID();
    ptyServer.create(sessionId, {
      cols: parsed.cols,
      rows: parsed.rows,
      ...(parsed.cwd ? { cwd: parsed.cwd } : {}),
      ...(parsed.env ? { env: parsed.env } : {}),
    });
    return reply.send({ sessionId });
  });

  // DELETE /pty/:id — kill session
  server.delete<{ Params: { id: string } }>('/pty/:id', async (req, reply) => {
    ptyServer.kill(req.params.id);
    return reply.send({ ok: true });
  });

  // WS /pty/:id — bidirectional terminal bridge
  server.get<{ Params: { id: string } }>(
    '/pty/:id',
    { websocket: true },
    (socket, req) => {
      const { id } = req.params;

      if (!ptyServer.has(id)) {
        socket.close(1008, 'Session not found');
        return;
      }

      // PTY → browser
      const offData = ptyServer.onData(id, (data) => {
        if (socket.readyState === socket.OPEN) {
          socket.send(JSON.stringify({ type: 'output', data }));
        }
      });

      const offExit = ptyServer.onExit(id, (code) => {
        if (socket.readyState === socket.OPEN) {
          socket.send(JSON.stringify({ type: 'exit', code }));
          socket.close(1000, 'Process exited');
        }
      });

      // browser → PTY
      socket.on('message', (raw: Buffer | string) => {
        try {
          const msg = JSON.parse(raw.toString()) as ClientMsg;
          if (msg.type === 'input') {
            ptyServer.write(id, msg.data);
          } else if (msg.type === 'resize') {
            ptyServer.resize(id, msg.cols, msg.rows);
          } else if (msg.type === 'kill') {
            ptyServer.kill(id);
            socket.close(1000, 'Killed');
          }
        } catch { /* ignore malformed */ }
      });

      socket.on('close', () => {
        offData();
        offExit();
        ptyServer.kill(id);
      });
    },
  );
}
