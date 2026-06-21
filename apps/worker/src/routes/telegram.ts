/**
 * Telegram management routes — B.5.
 */

import keytar from 'keytar';

import type { AuthFastifyInstance } from '../types/fastify';
import { telegramBridge } from '../telegram/bridge';

export async function telegramRoutes(server: AuthFastifyInstance) {
  // POST /telegram/start — start bridge with stored token
  server.post('/start', async (_req, reply) => {
    const token = await keytar.getPassword('wolfkrow', 'telegram-bot-token');
    if (!token) return reply.status(503).send({ error: 'Telegram bot token not configured' });

    await telegramBridge.start(token);
    return { started: true };
  });

  // POST /telegram/stop — stop polling
  server.post('/stop', async (_req, reply) => {
    telegramBridge.stop();
    return reply.send({ stopped: true });
  });

  // GET /telegram/status — is bridge running
  server.get('/status', async (_req, reply) => {
    return reply.send({ running: telegramBridge.isStarted() });
  });

  // POST /telegram/pair — generate pairing code for current user
  server.post<{ Body: { userId: string } }>('/pair', async (req, reply) => {
    const { userId } = req.body;
    if (!userId) return reply.status(400).send({ error: 'userId required' });
    const code = telegramBridge.generatePairingCode(userId);
    return reply.send({ code });
  });
}
