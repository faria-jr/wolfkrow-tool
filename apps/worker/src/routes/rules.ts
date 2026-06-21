/**
 * Global rules routes — S.3.
 */

import { DrizzleGlobalRuleRepo } from '@wolfkrow/infra/repos';
import {
  ListRulesUseCase,
  CreateRuleUseCase,
  UpdateRuleUseCase,
  ToggleRuleUseCase,
  DeleteRuleUseCase,
  BuildSystemPromptUseCase,
} from '@wolfkrow/use-cases';

import type { AuthFastifyInstance } from '../types/fastify';
import type { RuleKind } from '@wolfkrow/domain';

function getUserId(req: { user?: { userId?: string } }): string {
  return req.user?.userId ?? 'default';
}

export async function rulesRoutes(server: AuthFastifyInstance) {
  const repo = new DrizzleGlobalRuleRepo();
  const listUC = new ListRulesUseCase(repo);
  const createUC = new CreateRuleUseCase(repo);
  const updateUC = new UpdateRuleUseCase(repo);
  const toggleUC = new ToggleRuleUseCase(repo);
  const deleteUC = new DeleteRuleUseCase(repo);
  const buildUC = new BuildSystemPromptUseCase(repo);

  type CreateBody = { kind: RuleKind; title: string; body: string; enabled?: boolean; sortOrder?: number };
  type UpdateBody = { title?: string; body?: string; enabled?: boolean; sortOrder?: number };

  // GET /rules — list all
  server.get('/', async (req, reply) => {
    const rules = await listUC.execute(getUserId(req as { user?: { userId?: string } }));
    return reply.send({ rules: rules.map((r) => r.toProps()) });
  });

  // POST /rules — create
  server.post<{ Body: CreateBody }>('/', async (req, reply) => {
    const userId = getUserId(req as { user?: { userId?: string } });
    const rule = await createUC.execute({ userId, ...req.body });
    return reply.status(201).send({ rule: rule.toProps() });
  });

  // PATCH /rules/:id — update
  server.patch<{ Params: { id: string }; Body: UpdateBody }>('/:id', async (req, reply) => {
    const rule = await updateUC.execute({ id: req.params.id, ...req.body });
    return reply.send({ rule: rule.toProps() });
  });

  // POST /rules/:id/toggle — toggle enabled
  server.post<{ Params: { id: string } }>('/:id/toggle', async (req, reply) => {
    const rule = await toggleUC.execute(req.params.id);
    return reply.send({ rule: rule.toProps() });
  });

  // DELETE /rules/:id — delete
  server.delete<{ Params: { id: string } }>('/:id', async (req, reply) => {
    await deleteUC.execute(req.params.id);
    return reply.send({ ok: true });
  });

  // POST /rules/build-prompt — build system prompt for user
  server.post<{ Body: { agentSystemPrompt?: string; skillDescriptions?: string[] } }>(
    '/build-prompt',
    async (req, reply) => {
      const userId = getUserId(req as { user?: { userId?: string } });
      const prompt = await buildUC.execute({ userId, ...req.body });
      return reply.send({ prompt });
    },
  );
}
