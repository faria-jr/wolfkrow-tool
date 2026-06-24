import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

import { MgraphEngine } from '@wolfkrow/infra';

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
  request: { body: CreateBody | null },
  reply: { status: (n: number) => { send: (b: unknown) => unknown } },
) {
  const { path, kind, title, tags, body, source } = request.body ?? {};
  if (!path || !kind || !title || !body) {
    return reply.status(400).send({ error: 'path, kind, title, body required' });
  }
  const engine = await makeEngine();
  try {
    const note = await engine.createNote({
      path, kind, title, body,
      ...(tags ? { tags } : {}),
      ...(source ? { source } : {}),
    });
    return reply.send(note.toJSON());
  } catch (err) {
    return reply.status(400).send({ error: err instanceof Error ? err.message : String(err) });
  }
}

async function readHandler(
  request: { params: { path: string } },
  reply: { status: (n: number) => { send: (b: unknown) => unknown } },
) {
  const engine = await makeEngine();
  const note = await engine.readNote(decodeURIComponent(request.params.path));
  if (!note) return reply.status(404).send({ error: 'Note not found' });
  return reply.send(note.toJSON());
}

async function updateHandler(
  request: { params: { path: string }; body: UpdateBody | null },
  reply: { status: (n: number) => { send: (b: unknown) => unknown } },
) {
  const { body, title, tags } = request.body ?? {};
  if (!body) return reply.status(400).send({ error: 'body required' });
  const engine = await makeEngine();
  try {
    const note = await engine.updateNote(decodeURIComponent(request.params.path), body, title, tags);
    return reply.send(note.toJSON());
  } catch (err) {
    return reply.status(400).send({ error: err instanceof Error ? err.message : String(err) });
  }
}

async function deleteHandler(request: { params: { path: string } }): Promise<{ ok: true }> {
  const engine = await makeEngine();
  await engine.deleteNote(decodeURIComponent(request.params.path));
  return { ok: true };
}

async function graphHandler() {
  const engine = await makeEngine();
  return engine.buildGraphData();
}

async function searchHandler(request: { query: SearchQuery }) {
  const q = request.query.q ?? '';
  const limit = request.query.limit ? parseInt(request.query.limit, 10) : 20;
  const kind = request.query.kind as VaultKind | undefined;
  const engine = await makeEngine();
  return engine.searchVault({ query: q, limit, ...(kind ? { kind } : {}) });
}

async function statsHandler() {
  const engine = await makeEngine();
  return engine.getStats();
}

export async function mgraphRoutes(server: AuthFastifyInstance) {
  const auth = { preHandler: [server.authenticate] };

  server.post<{ Body: CreateBody }>('/mgraph/notes', auth, createHandler as never);
  server.get<{ Params: { path: string } }>('/mgraph/notes/:path', auth, readHandler as never);
  server.patch<{ Params: { path: string }; Body: UpdateBody }>('/mgraph/notes/:path', auth, updateHandler as never);
  server.delete<{ Params: { path: string } }>('/mgraph/notes/:path', auth, deleteHandler as never);
  server.get('/mgraph/graph', auth, graphHandler);
  server.get<{ Querystring: SearchQuery }>('/mgraph/search', auth, searchHandler);
  server.get('/mgraph/stats', auth, statsHandler);
}
