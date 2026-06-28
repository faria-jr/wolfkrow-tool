import { RepoProfilerService } from '@wolfkrow/infra';

import type { AuthFastifyInstance } from '../types/fastify';

interface ProfilerBody {
  dir: string;
}

export async function profilerRoutes(server: AuthFastifyInstance) {
  server.post<{ Body: ProfilerBody }>(
    '/profiler',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const { dir } = request.body ?? {};
      if (!dir || typeof dir !== 'string') {
        return reply.status(400).send({ error: 'dir is required' });
      }
      const svc = new RepoProfilerService();
      const profile = await svc.profile(dir);
      return reply.send({
        root: profile.root,
        languages: [...profile.languages],
        frameworks: [...profile.frameworks],
        roles: profile.roles,
        fileCount: profile.fileCount,
        summary: profile.toSummary(),
      });
    }
  );
}
