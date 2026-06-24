import { ChatSession } from '@wolfkrow/domain';

import { getRepos } from '../container';
import type { AuthFastifyInstance } from '../types/fastify';

interface SessionPatchBody { title?: string; archived?: boolean; }

async function listSessions(server: AuthFastifyInstance) {
  server.get('/sessions', { preHandler: [server.authenticate] }, async (req) => {
    const userId = req.user?.userId ?? 'anonymous';
    const sessions = await getRepos().chatSession.findByUserId(userId);
    return sessions
      .filter((s) => !s.archived)
      .sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime())
      .map((s) => s.toProps());
  });
}

async function createSession(server: AuthFastifyInstance) {
  server.post('/sessions', { preHandler: [server.authenticate] }, async (req) => {
    const userId = req.user?.userId ?? 'anonymous';
    const session = ChatSession.create({ userId, agentId: undefined, title: 'New Chat', archived: false });
    await getRepos().chatSession.save(session);
    return session.toProps();
  });
}

async function patchSession(server: AuthFastifyInstance) {
  server.patch<{ Params: { id: string }; Body: SessionPatchBody }>(
    '/sessions/:id',
    { preHandler: [server.authenticate] },
    async (req, reply) => {
      const userId = req.user?.userId ?? 'anonymous';
      const s = await getRepos().chatSession.findById(req.params.id);
      if (!s || s.userId !== userId) return reply.status(404).send({ error: 'Not found' });
      const updated = ChatSession.fromProps({
        ...s.toProps(),
        ...(req.body.title !== undefined ? { title: req.body.title } : {}),
        ...(req.body.archived !== undefined ? { archived: req.body.archived } : {}),
        updatedAt: new Date(),
      });
      await getRepos().chatSession.save(updated);
      return updated.toProps();
    },
  );
}

async function deleteSession(server: AuthFastifyInstance) {
  server.delete<{ Params: { id: string } }>(
    '/sessions/:id',
    { preHandler: [server.authenticate] },
    async (req, reply) => {
      const userId = req.user?.userId ?? 'anonymous';
      const s = await getRepos().chatSession.findById(req.params.id);
      if (!s || s.userId !== userId) return reply.status(404).send({ error: 'Not found' });
      await getRepos().message.deleteBySessionId(req.params.id);
      await getRepos().chatSession.delete(req.params.id);
      return { deleted: true };
    },
  );
}

async function getMessages(server: AuthFastifyInstance) {
  server.get<{ Params: { id: string } }>(
    '/sessions/:id/messages',
    { preHandler: [server.authenticate] },
    async (req, reply) => {
      const userId = req.user?.userId ?? 'anonymous';
      const s = await getRepos().chatSession.findById(req.params.id);
      if (!s || s.userId !== userId) return reply.status(404).send({ error: 'Not found' });
      const messages = await getRepos().message.findBySessionId(req.params.id);
      return messages.map((m) => m.toProps());
    },
  );
}

export async function chatSessionRoutes(server: AuthFastifyInstance) {
  await listSessions(server);
  await createSession(server);
  await patchSession(server);
  await deleteSession(server);
  await getMessages(server);
}
