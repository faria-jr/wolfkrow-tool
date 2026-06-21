/**
 * Memory routes — add, list, search, delete memories; daily summaries.
 * N.5: SPEC-015 semantic memory with vector search.
 */

import type { MemorySearchResult, SemanticMemory } from '@wolfkrow/domain';
import { DrizzleDailySummaryRepo, DrizzleSemanticMemoryRepo, VoyageEmbedder } from '@wolfkrow/infra';
import {
  AddMemoryUseCase,
  DeleteMemoryUseCase,
  GenerateDailySummaryUseCase,
  ListMemoriesUseCase,
  SearchMemoryUseCase,
} from '@wolfkrow/use-cases';

import type { AuthFastifyInstance } from '../types/fastify';

const VOYAGE_API_KEY = process.env['VOYAGE_API_KEY'] ?? '';

function makeRepos() {
  return {
    memoryRepo: new DrizzleSemanticMemoryRepo(),
    summaryRepo: new DrizzleDailySummaryRepo(),
  };
}

function makeEmbedder() {
  return new VoyageEmbedder(VOYAGE_API_KEY);
}

interface AddMemoryBody {
  content: string;
  source: 'conversation' | 'compaction' | 'user' | 'agent';
  importance?: number;
  metadata?: Record<string, unknown>;
}

interface SearchBody {
  query: string;
  limit?: number;
}

export async function memoryRoutes(app: AuthFastifyInstance) {
  app.post<{ Body: AddMemoryBody }>('/memory', {
    onRequest: [app.authenticate],
  }, async (req, reply) => {
    const userId = (req as unknown as { user: { userId: string } }).user.userId;
    const body = req.body;
    if (!body?.content) return reply.code(400).send({ error: 'content required' });

    const { memoryRepo } = makeRepos();
    const uc = new AddMemoryUseCase(memoryRepo, makeEmbedder());
    const result = await uc.execute({
      userId,
      content: body.content,
      source: body.source ?? 'user',
      importance: body.importance ?? 50,
      ...(body.metadata !== undefined ? { metadata: body.metadata } : {}),
    });

    return reply.code(201).send({ memory: result.memory.toProps() });
  });

  app.get('/memory', {
    onRequest: [app.authenticate],
  }, async (req, reply) => {
    const userId = (req as unknown as { user: { userId: string } }).user.userId;
    const { memoryRepo } = makeRepos();
    const uc = new ListMemoriesUseCase(memoryRepo);
    const result = await uc.execute({ userId });
    return reply.send({ memories: result.memories.map((m: SemanticMemory) => m.toProps()) });
  });

  app.post<{ Body: SearchBody }>('/memory/search', {
    onRequest: [app.authenticate],
  }, async (req, reply) => {
    const userId = (req as unknown as { user: { userId: string } }).user.userId;
    const body = req.body;
    if (!body?.query) return reply.code(400).send({ error: 'query required' });

    const { memoryRepo } = makeRepos();
    const uc = new SearchMemoryUseCase(memoryRepo, makeEmbedder());
    const result = await uc.execute({
      userId,
      query: body.query,
      ...(body.limit !== undefined ? { limit: body.limit } : {}),
    });

    return reply.send({
      results: result.results.map((r: MemorySearchResult) => ({
        memory: r.memory.toProps(),
        distance: r.distance,
      })),
    });
  });

  app.delete<{ Params: { id: string } }>('/memory/:id', {
    onRequest: [app.authenticate],
  }, async (req, reply) => {
    const userId = (req as unknown as { user: { userId: string } }).user.userId;
    const { memoryRepo } = makeRepos();
    const uc = new DeleteMemoryUseCase(memoryRepo);
    await uc.execute({ memoryId: req.params.id, userId });
    return reply.send({ deleted: true });
  });

  app.get('/memory/summaries', {
    onRequest: [app.authenticate],
  }, async (req, reply) => {
    const userId = (req as unknown as { user: { userId: string } }).user.userId;
    const repo = new DrizzleDailySummaryRepo();
    const summaries = await repo.findByUserId(userId);
    return reply.send({ summaries: summaries.map((s) => s.toProps()) });
  });

  app.post<{ Body: { date?: string; content?: string } }>('/memory/summaries', {
    onRequest: [app.authenticate],
  }, async (req, reply) => {
    const userId = (req as unknown as { user: { userId: string } }).user.userId;
    const body = req.body ?? {};
    const date = body.date ?? new Date().toISOString().slice(0, 10);

    const { summaryRepo } = makeRepos();
    const uc = new GenerateDailySummaryUseCase(summaryRepo);
    const result = await uc.execute({
      userId,
      date,
      content: body.content ?? `Manual summary for ${date}`,
      sessionCount: 0,
      messageCount: 0,
      tokensUsed: 0,
      cost: 0,
    });

    return reply.code(201).send({ summary: result.summary.toProps() });
  });
}
