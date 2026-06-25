/**
 * Telegram management routes — B.5.
 */

import { getSecret } from '../lib/keychain';
import { telegramBridge } from '../telegram/bridge';
import type { AuthFastifyInstance } from '../types/fastify';

/** Derive the authenticated user's id from the session — never from the body. */
const uid = (req: { user?: { userId?: string } }): string =>
  (req as unknown as { user: { userId: string } }).user.userId;

export async function telegramRoutes(server: AuthFastifyInstance) {
  // The bridge controls (start/stop) and pairing are privileged operations; the
  // pairing code is user-scoped. Require an authenticated session on every
  // route so an anonymous caller cannot start/stop the bridge or mint a pairing
  // code (the default-user leak class of P0-7/P2-1).
  const auth = { onRequest: [server.authenticate] };

  // POST /telegram/start — start bridge with stored token
  server.post('/start', auth, async (_req, reply) => {
    const token = await getSecret('telegram-bot-token');
    if (!token) return reply.status(503).send({ error: 'Telegram bot token not configured' });

    await telegramBridge.start(token);
    return { started: true };
  });

  // POST /telegram/stop — stop polling
  server.post('/stop', auth, async (_req, reply) => {
    telegramBridge.stop();
    return reply.send({ stopped: true });
  });

  // GET /telegram/status — is bridge running
  server.get('/status', auth, async (_req, reply) => {
    return reply.send({ running: telegramBridge.isStarted() });
  });

  // POST /telegram/pair — generate pairing code for the authenticated user.
  // The userId is derived from the session (req.user.userId), never from the
  // request body, so an authenticated user cannot mint a pairing code for
  // another user (IDOR).
  server.post('/pair', auth, async (req, reply) => {
    const code = telegramBridge.generatePairingCode(uid(req));
    return reply.send({ code });
  });
}
