/**
 * Knowledge graph routes — S.5
 *
 * GET  /graph              — full graph (nodes + edges) for user
 * POST /graph/ingest       — ingest text and extract entities
 * GET  /graph/:id          — neighborhood of a node (depth=1 default)
 * DELETE /graph/:id        — delete node (cascade edges)
 */

import type { AuthFastifyInstance } from '../types/fastify';
import { mgraph } from '../knowledge/mgraph';
import { graphIngest } from '../knowledge/graph-ingest';

function getUserId(req: { user?: { userId?: string } }): string {
  return req.user?.userId ?? 'default';
}

interface IngestBody {
  text: string;
  sourceId?: string;
  sourceLabel?: string;
}

interface NeighborhoodQuery {
  depth?: string;
}

export async function graphRoutes(server: AuthFastifyInstance) {
  // GET /graph — full graph
  server.get('/', async (req, reply) => {
    const userId = getUserId(req as { user?: { userId?: string } });
    const nodes = mgraph.listNodes(userId);
    const edges = mgraph.listEdges(userId);
    return reply.send({ nodes, edges });
  });

  // POST /graph/ingest
  server.post<{ Body: IngestBody }>('/ingest', async (req, reply) => {
    const userId = getUserId(req as { user?: { userId?: string } });
    const { text, sourceId, sourceLabel } = req.body;
    if (!text?.trim()) {
      return reply.status(400).send({ error: 'text is required' });
    }
    const result = graphIngest.ingest({
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

  // GET /graph/:id — neighborhood
  server.get<{ Params: { id: string }; Querystring: NeighborhoodQuery }>(
    '/:id',
    async (req, reply) => {
      const userId = getUserId(req as { user?: { userId?: string } });
      const depth = Math.min(parseInt(req.query.depth ?? '1', 10) || 1, 3);
      const neighborhood = mgraph.neighborhood(userId, req.params.id, depth);
      if (!neighborhood) return reply.status(404).send({ error: 'Node not found' });
      return reply.send(neighborhood);
    },
  );

  // DELETE /graph/:id
  server.delete<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const userId = getUserId(req as { user?: { userId?: string } });
    mgraph.deleteNode(userId, req.params.id);
    return reply.send({ ok: true });
  });
}
