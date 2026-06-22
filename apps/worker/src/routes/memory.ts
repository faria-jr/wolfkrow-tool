/**
 * Memory routes — add, list, search, delete memories; daily summaries.
 * N.5: SPEC-015 semantic memory with vector search.
 */

import type { MemorySearchResult, SemanticMemory } from '@wolfkrow/domain';
import {
  AddMemoryUseCase,
  DeleteMemoryUseCase,
  GenerateDailySummaryUseCase,
  ListMemoriesUseCase,
  SearchMemoryUseCase,
} from '@wolfkrow/use-cases';
import type { FastifyReply, FastifyRequest } from 'fastify';

import { getAdapters, getRepos } from '../container';
import type { AuthFastifyInstance } from '../types/fastify';

function makeRepos() {
  const r = getRepos();
  return {
    memoryRepo: r.semanticMemory,
    summaryRepo: r.dailySummary,
  };
}

function makeEmbedder() {
  return getAdapters().embedder;
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

async function handleAddMemory(req: FastifyRequest<{ Body: AddMemoryBody }>, reply: FastifyReply) {
  const userId = (req as unknown as { user: { userId: string } }).user.userId;
  const body = req.body;
  if (!body?.content) return reply.code(400).send({ error: 'content required' });
  const { memoryRepo } = makeRepos();
  const result = await new AddMemoryUseCase(memoryRepo, makeEmbedder()).execute({
    userId,
    content: body.content,
    source: body.source ?? 'user',
    importance: body.importance ?? 50,
    ...(body.metadata !== undefined ? { metadata: body.metadata } : {}),
  });
  return reply.code(201).send({ memory: result.memory.toProps() });
}

async function handleListMemories(req: FastifyRequest, reply: FastifyReply) {
  const userId = (req as unknown as { user: { userId: string } }).user.userId;
  const { memoryRepo } = makeRepos();
  const result = await new ListMemoriesUseCase(memoryRepo).execute({ userId });
  return reply.send({ memories: result.memories.map((m: SemanticMemory) => m.toProps()) });
}

async function handleSearchMemories(req: FastifyRequest<{ Body: SearchBody }>, reply: FastifyReply) {
  const userId = (req as unknown as { user: { userId: string } }).user.userId;
  const body = req.body;
  if (!body?.query) return reply.code(400).send({ error: 'query required' });
  const { memoryRepo } = makeRepos();
  const result = await new SearchMemoryUseCase(memoryRepo, makeEmbedder()).execute({
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
}

async function handleDeleteMemory(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
  const userId = (req as unknown as { user: { userId: string } }).user.userId;
  const { memoryRepo } = makeRepos();
  await new DeleteMemoryUseCase(memoryRepo).execute({ memoryId: req.params.id, userId });
  return reply.send({ deleted: true });
}

async function handleGetSummaries(req: FastifyRequest, reply: FastifyReply) {
  const userId = (req as unknown as { user: { userId: string } }).user.userId;
  const summaries = await getRepos().dailySummary.findByUserId(userId);
  return reply.send({ summaries: summaries.map((s) => s.toProps()) });
}

async function handleCreateSummary(
  req: FastifyRequest<{ Body: { date?: string; content?: string } }>,
  reply: FastifyReply,
) {
  const userId = (req as unknown as { user: { userId: string } }).user.userId;
  const body = req.body ?? {};
  const date = body.date ?? new Date().toISOString().slice(0, 10);
  const { summaryRepo } = makeRepos();
  const result = await new GenerateDailySummaryUseCase(summaryRepo).execute({
    userId,
    date,
    content: body.content ?? `Manual summary for ${date}`,
    sessionCount: 0,
    messageCount: 0,
    tokensUsed: 0,
    cost: 0,
  });
  return reply.code(201).send({ summary: result.summary.toProps() });
}

export async function memoryRoutes(app: AuthFastifyInstance) {
  const auth = { onRequest: [app.authenticate] };
  app.post<{ Body: AddMemoryBody }>('/memory', auth, handleAddMemory);
  app.get('/memory', auth, handleListMemories);
  app.post<{ Body: SearchBody }>('/memory/search', auth, handleSearchMemories);
  app.delete<{ Params: { id: string } }>('/memory/:id', auth, handleDeleteMemory);
  app.get('/memory/summaries', auth, handleGetSummaries);
  app.post<{ Body: { date?: string; content?: string } }>('/memory/summaries', auth, handleCreateSummary);
}
