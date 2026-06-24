import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

import { MgraphEngine } from '@wolfkrow/infra';
import type { FastifyReply, FastifyRequest } from 'fastify';

import type { AuthFastifyInstance } from '../types/fastify';

interface CreateBody {
  path: string;
  kind: 'entity' | 'meeting' | 'decision' | 'project' | 'reference';
  title: string;
  tags?: string[];
  body: string;
  source?: string;
}

interface UpdateBody {
  body: string;
  title?: string;
  tags?: string[];
}

interface SearchQuery { q?: string; kind?: string; limit?: string; }

interface NoteParams { path: string; }

type VaultKind = 'entity' | 'meeting' | 'decision' | 'project' | 'reference';

function defaultVaultRoot(): string {
  return process.env['WOLFKROW_VAULT_ROOT'] ?? join(process.cwd(), '.wolfkrow', 'vault');
}

async function makeEngine(): Promise<MgraphEngine> {
  const root = defaultVaultRoot();
  await mkdir(root, { recursive: true });
  const engine = new MgraphEngine({ vaultRoot: root });
  await engine.ensureVault();
  return engine;
}

async function createHandler(
  request: FastifyRequest<{ Body: CreateBody }>,
  reply: FastifyReply,
) {
  const { path, kind, title, tags, body, source } = request.body;
  if (!path || !kind || !title || !body) {
    return reply.status(400).send({ error: 'path, kind, title, body required' });
  }
  const engine = await makeEngine();
  try {
    const note = await engine.createNote({
      path, kind, title, body,
      ...(tags !== undefined ? { tags } : {}),
      ...(source !== undefined ? { source } : {}),
    });
    return reply.send(note.toJSON());
  } catch (err) {
    return reply.status(400).send({ error: err instanceof Error ? err.message : String(err) });
  }
}

async function readHandler(
  request: FastifyRequest<{ Params: NoteParams }>,
  reply: FastifyReply,
) {
  const engine = await makeEngine();
  const note = await engine.readNote(decodeURIComponent(request.params.path));
  if (!note) return reply.status(404).send({ error: 'Note not found' });
  return reply.send(note.toJSON());
}

async function updateHandler(
  request: FastifyRequest<{ Params: NoteParams; Body: UpdateBody }>,
  reply: FastifyReply,
) {
  const { body, title, tags } = request.body;
  if (!body) return reply.status(400).send({ error: 'body required' });
  const engine = await makeEngine();
  try {
    const note = await engine.updateNote(decodeURIComponent(request.params.path), body, title, tags);
    return reply.send(note.toJSON());
  } catch (err) {
    return reply.status(400).send({ error: err instanceof Error ? err.message : String(err) });
  }
}

async function deleteHandler(
  request: FastifyRequest<{ Params: NoteParams }>,
  reply: FastifyReply,
) {
  const engine = await makeEngine();
  await engine.deleteNote(decodeURIComponent(request.params.path));
  return reply.send({ ok: true });
}

async function graphHandler(_request: FastifyRequest, reply: FastifyReply) {
  const engine = await makeEngine();
  const data = await engine.buildGraphData();
  return reply.send(data);
}

async function searchHandler(
  request: FastifyRequest<{ Querystring: SearchQuery }>,
  reply: FastifyReply,
) {
  const q = request.query.q ?? '';
  const limit = request.query.limit ? parseInt(request.query.limit, 10) : 20;
  const kind = request.query.kind as VaultKind | undefined;
  const engine = await makeEngine();
  const results = await engine.searchVault({ query: q, limit, ...(kind !== undefined ? { kind } : {}) });
  return reply.send(results);
}

async function statsHandler(_request: FastifyRequest, reply: FastifyReply) {
  const engine = await makeEngine();
  const stats = await engine.getStats();
  return reply.send(stats);
}

export async function mgraphRoutes(server: AuthFastifyInstance) {
  const auth = { preHandler: [server.authenticate] };

  server.post<{ Body: CreateBody }>('/mgraph/notes', auth, createHandler);
  server.get<{ Params: { path: string } }>('/mgraph/notes/:path', auth, readHandler);
  server.patch<{ Params: { path: string }; Body: UpdateBody }>('/mgraph/notes/:path', auth, updateHandler);
  server.delete<{ Params: { path: string } }>('/mgraph/notes/:path', auth, deleteHandler);
  server.get('/mgraph/graph', auth, graphHandler);
  server.get<{ Querystring: SearchQuery }>('/mgraph/search', auth, searchHandler);
  server.get('/mgraph/stats', auth, statsHandler);
}
