import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

import { VAULT_KINDS, type VaultKind } from '@wolfkrow/domain';
import { MgraphEngine } from '@wolfkrow/infra';
import type { FastifyReply, FastifyRequest } from 'fastify';

import type { AuthFastifyInstance } from '../types/fastify';
import { validate, z } from '../validation';

const createNoteBody = z.object({
  path: z.string().min(1).max(1024),
  kind: z.enum(VAULT_KINDS),
  title: z.string().min(1).max(512),
  tags: z.array(z.string().max(64)).max(50).optional(),
  body: z.string().min(1).max(500_000),
  source: z.string().max(1024).optional(),
});

const updateNoteBody = z.object({
  body: z.string().min(1).max(500_000),
  title: z.string().min(1).max(512).optional(),
  tags: z.array(z.string().max(64)).max(50).optional(),
});

const searchQuery = z.object({
  q: z.string().max(512).optional(),
  kind: z.string().max(64).optional(),
  limit: z.string().max(8).optional(),
});

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

async function createHandler(request: FastifyRequest, reply: FastifyReply) {
  const body = validate(createNoteBody, request.body);
  const engine = await makeEngine();
  try {
    const note = await engine.createNote({
      path: body.path,
      kind: body.kind,
      title: body.title,
      body: body.body,
      ...(body.tags !== undefined ? { tags: body.tags } : {}),
      ...(body.source !== undefined ? { source: body.source } : {}),
    });
    return reply.send(note.toJSON());
  } catch (err) {
    return reply.status(400).send({ error: err instanceof Error ? err.message : String(err) });
  }
}

async function readHandler(request: FastifyRequest, reply: FastifyReply) {
  const engine = await makeEngine();
  const note = await engine.readNote(decodeURIComponent((request.params as { path: string }).path));
  if (!note) return reply.status(404).send({ error: 'Note not found' });
  return reply.send(note.toJSON());
}

async function updateHandler(request: FastifyRequest, reply: FastifyReply) {
  const body = validate(updateNoteBody, request.body);
  const engine = await makeEngine();
  try {
    const note = await engine.updateNote(
      decodeURIComponent((request.params as { path: string }).path),
      body.body,
      body.title,
      body.tags
    );
    return reply.send(note.toJSON());
  } catch (err) {
    return reply.status(400).send({ error: err instanceof Error ? err.message : String(err) });
  }
}

async function deleteHandler(request: FastifyRequest, reply: FastifyReply) {
  const engine = await makeEngine();
  await engine.deleteNote(decodeURIComponent((request.params as { path: string }).path));
  return reply.send({ ok: true });
}

async function graphHandler(_request: FastifyRequest, reply: FastifyReply) {
  const engine = await makeEngine();
  const data = await engine.buildGraphData();
  return reply.send(data);
}

async function searchHandler(request: FastifyRequest, reply: FastifyReply) {
  const q = validate(searchQuery, request.query);
  const limit = q.limit ? parseInt(q.limit, 10) : 20;
  const kind = q.kind as VaultKind | undefined;
  const engine = await makeEngine();
  const results = await engine.searchVault({
    query: q.q ?? '',
    limit,
    ...(kind !== undefined ? { kind } : {}),
  });
  return reply.send(results);
}

async function statsHandler(_request: FastifyRequest, reply: FastifyReply) {
  const engine = await makeEngine();
  const stats = await engine.getStats();
  return reply.send(stats);
}

export async function mgraphRoutes(server: AuthFastifyInstance) {
  const auth = { preHandler: [server.authenticate] };

  server.post('/mgraph/notes', auth, createHandler);
  server.get('/mgraph/notes/:path', auth, readHandler);
  server.patch('/mgraph/notes/:path', auth, updateHandler);
  server.delete('/mgraph/notes/:path', auth, deleteHandler);
  server.get('/mgraph/graph', auth, graphHandler);
  server.get('/mgraph/search', auth, searchHandler);
  server.get('/mgraph/stats', auth, statsHandler);
}
