/**
 * Usage routes — token analytics. S.2.
 */

import { DrizzleTokenUsageRepo } from '@wolfkrow/infra/repos';
import { ComputeUsageUseCase, CheckBudgetUseCase } from '@wolfkrow/use-cases';

import type { AuthFastifyInstance } from '../types/fastify';

function getUserId(req: { user?: { userId?: string } }): string {
  return req.user?.userId ?? 'default';
}

export async function usageRoutes(server: AuthFastifyInstance) {
  const repo = new DrizzleTokenUsageRepo();
  const computeUC = new ComputeUsageUseCase(repo as never);
  const budgetUC = new CheckBudgetUseCase(repo as never);

  type QueryFilter = { from?: string; to?: string; source?: string; agentId?: string };

  // GET /usage/summary?from=&to=&source=&agentId=
  server.get<{ Querystring: QueryFilter }>('/summary', async (req, reply) => {
    const userId = getUserId(req as { user?: { userId?: string } });
    const { from, to, source, agentId } = req.query;
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
  server.get<{ Querystring: { budgetUSD?: string; agentId?: string; periodDays?: string } }>(
    '/budget',
    async (req, reply) => {
      const userId = getUserId(req as { user?: { userId?: string } });
      const budget = Number(req.query.budgetUSD ?? 50);
      const result = budgetUC.execute({
        userId,
        budgetUSD: budget,
        ...(req.query.agentId ? { agentId: req.query.agentId } : {}),
        ...(req.query.periodDays ? { periodDays: Number(req.query.periodDays) } : {}),
      });
      return reply.send(result);
    },
  );

  // GET /usage/records?from=&to=&source=&agentId=
  server.get<{ Querystring: QueryFilter }>('/records', async (req, reply) => {
    const userId = getUserId(req as { user?: { userId?: string } });
    const { from, to, source, agentId } = req.query;
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
