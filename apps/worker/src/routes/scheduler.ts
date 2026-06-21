/**
 * Scheduler routes
 */

import { getScheduledTasksRepository } from '@wolfkrow/infra/repos';

import type { AuthFastifyInstance } from '../types/fastify';

export async function schedulerRoutes(server: AuthFastifyInstance) {
  server.get('/tasks', { preHandler: [server.authenticate] }, async () => {
    const repo = getScheduledTasksRepository();
    const tasks = repo.findEnabledTasksDueBy(new Date());
    return { tasks, count: tasks.length };
  });

  server.post('/tasks/:id/run', { preHandler: [server.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    return reply.status(202).send({ taskId: id, status: 'queued' });
  });
}
