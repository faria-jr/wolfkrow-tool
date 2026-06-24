/**
 * Skills routes — list the skills available to the authenticated user.
 *
 * GET /skills — built-in + user skills (drives the wolfkrow-skills MCP server,
 * All routes require authentication; userId comes from the token.
 */

import { ListSkillsUseCase } from '@wolfkrow/use-cases';

import { getRepos } from '../container';
import type { AuthFastifyInstance } from '../types/fastify';

function userIdOf(req: { user?: { userId?: string } }): string {
 const userId = req.user?.userId;
 if (!userId) throw new Error('unreachable: authenticate must populate req.user');
 return userId;
}

export async function skillsRoutes(server: AuthFastifyInstance) {
 const auth = { onRequest: [server.authenticate] };

 server.get('/', auth, async (req, reply) => {
 const userId = userIdOf(req);
 const result = await new ListSkillsUseCase(getRepos().skill).execute({ userId });
 return reply.send({ skills: result.skills.map((s) => s.toProps()) });
 });
}
