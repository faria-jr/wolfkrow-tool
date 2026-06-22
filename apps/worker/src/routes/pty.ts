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

import { randomUUID } from 'crypto';

import websocket from '@fastify/websocket';
import type { WebSocket } from '@fastify/websocket';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

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

function handlePtyMessage(id: string, raw: Buffer | string): void {
  try {
    const msg = JSON.parse(raw.toString()) as ClientMsg;
    if (msg.type === 'input') {
      ptyServer.write(id, msg.data);
    } else if (msg.type === 'resize') {
      ptyServer.resize(id, msg.cols, msg.rows);
    } else if (msg.type === 'kill') {
      ptyServer.kill(id);
    }
  } catch { /* ignore malformed */ }
}

function handlePtyWs(socket: WebSocket, id: string): void {
  if (!ptyServer.has(id)) { socket.close(1008, 'Session not found'); return; }

  const offData = ptyServer.onData(id, (data) => {
    if (socket.readyState === socket.OPEN) socket.send(JSON.stringify({ type: 'output', data }));
  });
  const offExit = ptyServer.onExit(id, (code) => {
    if (socket.readyState === socket.OPEN) {
      socket.send(JSON.stringify({ type: 'exit', code }));
      socket.close(1000, 'Process exited');
    }
  });

  socket.on('message', (raw: Buffer | string) => { handlePtyMessage(id, raw); });
  socket.on('close', () => { offData(); offExit(); ptyServer.kill(id); });
}

export async function ptyRoutes(server: FastifyInstance) {
  await server.register(websocket);

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

  server.delete<{ Params: { id: string } }>('/pty/:id', async (req, reply) => {
    ptyServer.kill(req.params.id);
    return reply.send({ ok: true });
  });

  server.get<{ Params: { id: string } }>(
    '/pty/:id',
    { websocket: true },
    (socket, req) => handlePtyWs(socket, req.params.id),
  );
}
