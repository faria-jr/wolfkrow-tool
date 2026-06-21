/**
 * Usage routes — token analytics. S.2.
 */

import { z } from 'zod';

import { DrizzleTokenUsageRepo } from '@wolfkrow/infra/repos';
import { ComputeUsageUseCase, CheckBudgetUseCase } from '@wolfkrow/use-cases';

import type { AuthFastifyInstance } from '../types/fastify';
import { validate } from '../validation';

const usageQuery = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  source: z.string().max(128).optional(),
  agentId: z.string().max(128).optional(),
});

const budgetQuery = z.object({
  budgetUSD: z.coerce.number().positive().max(100_000).default(50),
  agentId: z.string().max(128).optional(),
  periodDays: z.coerce.number().int().min(1).max(365).optional(),
});

function getUserId(req: { user?: { userId?: string } }): string {
  return req.user?.userId ?? 'default';
}

export async function usageRoutes(server: AuthFastifyInstance) {
  const repo = new DrizzleTokenUsageRepo();
  const computeUC = new ComputeUsageUseCase(repo as never);
  const budgetUC = new CheckBudgetUseCase(repo as never);

  // GET /usage/summary?from=&to=&source=&agentId=
  server.get<{ Querystring: unknown }>('/summary', async (req, reply) => {
    const userId = getUserId(req as { user?: { userId?: string } });
    const { from, to, source, agentId } = validate(usageQuery, req.query);
    const summary = computeUC.execute({
      userId,
      ...(from ? { from: new Date(from) } : {}),
      ...(to ? { to: new Date(to) } : {}),
      ...(source ? { source } : {}),
      ...(agentId ? { agentId } : {}),
    });
    return reply.send(summary);
  });

  // GET /usage/budget?budgetUSD=&agentId=&periodDays=
  server.get<{ Querystring: unknown }>('/budget', async (req, reply) => {
    const userId = getUserId(req as { user?: { userId?: string } });
    const { budgetUSD, agentId, periodDays } = validate(budgetQuery, req.query);
    const result = budgetUC.execute({
      userId,
      budgetUSD,
      ...(agentId ? { agentId } : {}),
      ...(periodDays ? { periodDays } : {}),
    });
    return reply.send(result);
  });

  // GET /usage/records?from=&to=&source=&agentId=
  server.get<{ Querystring: unknown }>('/records', async (req, reply) => {
    const userId = getUserId(req as { user?: { userId?: string } });
    const { from, to, source, agentId } = validate(usageQuery, req.query);
    const records = repo.findMany({
      userId,
      ...(from ? { from: new Date(from) } : {}),
      ...(to ? { to: new Date(to) } : {}),
      ...(source ? { source: source as never } : {}),
      ...(agentId ? { agentId } : {}),
    });
    return reply.send({ records });
  });
}
