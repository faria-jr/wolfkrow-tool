/**
 * Knowledge graph routes — S.5 (SPEC-022)
 *
 * All routes require authentication (Bearer JWT). userId is taken from the
 * verified token — there is no 'default' fallback, so each tenant's graph
 * is isolated.
 *
 * GET    /graph              — full graph (nodes + edges) for user
 * POST   /graph/ingest       — ingest text and extract entities
 * GET    /graph/:id          — neighborhood of a node (depth query, default 1)
 * DELETE /graph/:id          — delete node (cascade edges), 404 if missing
 */

import { GraphIngest } from '../knowledge/graph-ingest';
import { MGraph } from '../knowledge/mgraph';
import { validate, graphIngestBody, neighborhoodQuery } from '../validation';
import type { AuthFastifyInstance } from '../types/fastify';

function userIdOf(req: { user?: { userId?: string } }): string {
  const userId = req.user?.userId;
  if (!userId) throw new Error('unreachable: authenticate must populate req.user');
  return userId;
}

interface IngestBody { text?: string; sourceId?: string; sourceLabel?: string; }
interface NeighborhoodQuery { depth?: string; }

export async function graphRoutes(server: AuthFastifyInstance) {
  const auth = { onRequest: [server.authenticate] };

  // GET /graph — full graph
  server.get('/', auth, async (req, reply) => {
    const userId = userIdOf(req);
    const graph = new MGraph();
    const nodes = graph.listNodes(userId);
    const edges = graph.listEdges(userId);
    return reply.send({ nodes, edges });
  });

  // POST /graph/ingest
  server.post<{ Body: IngestBody }>('/ingest', auth, async (req, reply) => {
    const userId = userIdOf(req);
    const { text, sourceId, sourceLabel } = validate(graphIngestBody, req.body ?? {});
    const graph = new MGraph();
    const result = new GraphIngest(graph).ingest({
      userId,
      text,
      ...(sourceId !== undefined ? { sourceId } : {}),
      ...(sourceLabel !== undefined ? { sourceLabel } : {}),
    });
    return reply.status(201).send({
      documentNode: result.documentNode,
      entityCount: result.entityNodes.length,
      edgeCount: result.edgeCount,
    });
  });

  // GET /graph/:id — neighborhood / expand
  server.get<{ Params: { id: string }; Querystring: NeighborhoodQuery }>(
    '/:id',
    auth,
    async (req, reply) => {
      const userId = userIdOf(req);
      const { depth } = validate(neighborhoodQuery, req.query);
      const graph = new MGraph();
      const neighborhood = graph.neighborhood(userId, req.params.id, depth);
      if (!neighborhood) return reply.status(404).send({ error: 'Node not found' });
      return reply.send(neighborhood);
    },
  );

  // DELETE /graph/:id — cascade edges, 404 if missing
  server.delete<{ Params: { id: string } }>('/:id', auth, async (req, reply) => {
    const userId = userIdOf(req);
    const graph = new MGraph();
    const deleted = graph.deleteNode(userId, req.params.id);
    if (!deleted) return reply.status(404).send({ error: 'Node not found' });
    return reply.send({ ok: true });
  });
}
