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

export async function mgraphRoutes(server: AuthFastifyInstance) {
  server.post<{ Body: CreateBody }>(
    '/mgraph/notes',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
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
    },
  );

  server.get<{ Params: { path: string } }>(
    '/mgraph/notes/:path',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const engine = await makeEngine();
      const note = await engine.readNote(decodeURIComponent(request.params.path));
      if (!note) return reply.status(404).send({ error: 'Note not found' });
      return reply.send(note.toJSON());
    },
  );

  server.patch<{ Params: { path: string }; Body: UpdateBody }>(
    '/mgraph/notes/:path',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const { body, title, tags } = request.body ?? {};
      if (!body) return reply.status(400).send({ error: 'body required' });
      const engine = await makeEngine();
      try {
        const note = await engine.updateNote(decodeURIComponent(request.params.path), body, title, tags);
        return reply.send(note.toJSON());
      } catch (err) {
        return reply.status(400).send({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  );

  server.delete<{ Params: { path: string } }>(
    '/mgraph/notes/:path',
    { preHandler: [server.authenticate] },
    async (request) => {
      const engine = await makeEngine();
      await engine.deleteNote(decodeURIComponent(request.params.path));
      return { ok: true };
    },
  );

  server.get(
    '/mgraph/graph',
    { preHandler: [server.authenticate] },
    async () => {
      const engine = await makeEngine();
      return engine.buildGraphData();
    },
  );

  server.get<{ Querystring: SearchQuery }>(
    '/mgraph/search',
    { preHandler: [server.authenticate] },
    async (request) => {
      const q = request.query.q ?? '';
      const limit = request.query.limit ? parseInt(request.query.limit, 10) : 20;
      const kind = request.query.kind as 'entity' | 'meeting' | 'decision' | 'project' | 'reference' | undefined;
      const engine = await makeEngine();
      return engine.searchVault({ query: q, limit, ...(kind ? { kind } : {}) });
    },
  );

  server.get(
    '/mgraph/stats',
    { preHandler: [server.authenticate] },
    async () => {
      const engine = await makeEngine();
      return engine.getStats();
    },
  );
}
