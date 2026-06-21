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

import type { FastifyInstance } from 'fastify';
import { ptyServer } from '../pty/server';

type ClientMsg =
  | { type: 'input'; data: string }
  | { type: 'resize'; cols: number; rows: number }
  | { type: 'kill' };

export async function ptyRoutes(server: FastifyInstance) {
  await server.register(websocket);

  // POST /pty — create session, returns { sessionId }
  server.post('/pty', async (_req, reply) => {
    const sessionId = randomUUID();
    ptyServer.create(sessionId, { cols: 80, rows: 24 });
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
