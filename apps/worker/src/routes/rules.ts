/**
 * Global rules routes — S.3.
 */

import type { RuleKind } from '@wolfkrow/domain';
import {
  ListRulesUseCase,
  CreateRuleUseCase,
  UpdateRuleUseCase,
  ToggleRuleUseCase,
  DeleteRuleUseCase,
  BuildSystemPromptUseCase,
} from '@wolfkrow/use-cases';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';

import { getRepos } from '../container';
import { fromQuery, paginateArray } from '../lib/paginate';
import type { AuthFastifyInstance } from '../types/fastify';
import { validate } from '../validation';

const createBody = z.object({
  kind: z.enum(['behavior', 'soul', 'user', 'custom']),
  title: z.string().min(1).max(128),
  body: z.string().min(1).max(8192),
  enabled: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(999).default(0),
});

const updateBody = createBody.partial().omit({ kind: true });

const buildPromptBody = z.object({
  agentSystemPrompt: z.string().max(65536).optional(),
  skillDescriptions: z.array(z.string().max(4096)).max(50).optional(),
});

function getUserId(req: { user?: { userId?: string } }): string {
  return req.user?.userId ?? 'default';
}

const _repo = getRepos().globalRule;
const listUC = new ListRulesUseCase(_repo);
const createUC = new CreateRuleUseCase(_repo);
const updateUC = new UpdateRuleUseCase(_repo);
const toggleUC = new ToggleRuleUseCase(_repo);
const deleteUC = new DeleteRuleUseCase(_repo);
const buildUC = new BuildSystemPromptUseCase(_repo);

async function listRulesHandler(req: { user?: { userId?: string } }, reply: FastifyReply) {
  const rules = await listUC.execute(getUserId(req));
  const items = rules.map((r) => r.toProps());
  return reply.send(paginateArray(fromQuery((req as FastifyRequest).query), items, 'rules'));
}

async function createRuleHandler(
  req: FastifyRequest<{ Body: unknown }>,
  reply: FastifyReply
) {
  const userId = getUserId(req as { user?: { userId?: string } });
  const parsed = validate(createBody, req.body);
  const rule = await createUC.execute({
    userId,
    kind: parsed.kind as RuleKind,
    title: parsed.title,
    body: parsed.body,
    enabled: parsed.enabled,
    sortOrder: parsed.sortOrder,
  });
  return reply.status(201).send({ rule: rule.toProps() });
}

async function updateRuleHandler(
  req: FastifyRequest<{ Params: { id: string }; Body: unknown }>,
  reply: FastifyReply
) {
  const parsed = validate(updateBody, req.body);
  const rule = await updateUC.execute({
    id: req.params.id,
    ...(parsed.title !== undefined ? { title: parsed.title } : {}),
    ...(parsed.body !== undefined ? { body: parsed.body } : {}),
    ...(parsed.enabled !== undefined ? { enabled: parsed.enabled } : {}),
    ...(parsed.sortOrder !== undefined ? { sortOrder: parsed.sortOrder } : {}),
  });
  return reply.send({ rule: rule.toProps() });
}

async function toggleRuleHandler(
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const rule = await toggleUC.execute(req.params.id);
  return reply.send({ rule: rule.toProps() });
}

async function deleteRuleHandler(
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  await deleteUC.execute(req.params.id);
  return reply.send({ ok: true });
}

async function buildPromptHandler(
  req: FastifyRequest<{ Body: unknown }>,
  reply: FastifyReply
) {
  const userId = getUserId(req as { user?: { userId?: string } });
  const parsed = validate(buildPromptBody, req.body ?? {});
  const prompt = await buildUC.execute({
    userId,
    ...(parsed.agentSystemPrompt !== undefined
      ? { agentSystemPrompt: parsed.agentSystemPrompt }
      : {}),
    ...(parsed.skillDescriptions !== undefined
      ? { skillDescriptions: parsed.skillDescriptions }
      : {}),
  });
  return reply.send({ prompt });
}

export async function rulesRoutes(server: AuthFastifyInstance) {
  // Rules are user-scoped (getUserId resolves the owner from req.user). Without
  // authentication every request maps to the shared 'default' user, so all
  // browser users would share one rules set (the default-user leak class of
  // P0-7/P2-1). Authenticate every route in this plugin.
  const auth = { onRequest: [server.authenticate] };

  server.get('/', auth, listRulesHandler);
  server.post<{ Body: unknown }>('/', auth, createRuleHandler);
  server.patch<{ Params: { id: string }; Body: unknown }>('/:id', auth, updateRuleHandler);
  server.post<{ Params: { id: string } }>('/:id/toggle', auth, toggleRuleHandler);
  server.delete<{ Params: { id: string } }>('/:id', auth, deleteRuleHandler);
  server.post<{ Body: unknown }>('/build-prompt', auth, buildPromptHandler);
}
