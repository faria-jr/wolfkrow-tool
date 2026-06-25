/**
 * Graph routes — happy / error / auth paths.
 *
 * graph.ts drives IngestGraphUseCase / QueryNeighborhoodUseCase against
 * getRepos().graph. The ingest use-case extracts entities via regex (no AI),
 * so a mocked graph repo exercises the real route logic end-to-end. Auth uses
 * the real-behaving decorator (onRequest) so 401-without-session is genuine.
 */

import Fastify, { type FastifyInstance } from 'fastify';
import { describe, beforeAll, afterAll, it, expect, vi } from 'vitest';

const { nodes, edges, fakeGraphRepo } = vi.hoisted(() => {
  const nodes = new Map<string, { id: string; userId: string; label: string; type: string }>();
  const edges = new Map<string, { id: string; userId: string; source: string; target: string; type: string }>();
  const fakeGraphRepo = {
    listNodes: (userId: string) => [...nodes.values()].filter((n) => n.userId === userId),
    listEdges: (userId: string) => [...edges.values()].filter((e) => e.userId === userId),
    neighborhood: (userId: string, nodeId: string, _depth = 1) => {
      const node = [...nodes.values()].find((n) => n.userId === userId && n.id === nodeId);
      if (!node) return null;
      return { center: node, nodes: [node], edges: [] };
    },
    deleteNode: (userId: string, nodeId: string) => {
      const existing = [...nodes.values()].find((n) => n.userId === userId && n.id === nodeId);
      if (!existing) return false;
      nodes.delete(nodeId);
      return true;
    },
    // Used by IngestGraphUseCase (upsertNode / upsertEdge)
    upsertNode: vi.fn((input: { label: string; type: string }) => ({
      id: input.type === 'document' ? 'doc-1' : `e-${input.label}`,
      userId: 'u1',
      label: input.label,
      type: input.type,
    })),
    upsertEdge: vi.fn(() => ({ id: 'edge-1' })),
    exists: vi.fn(() => false),
  };
  return { nodes, edges, fakeGraphRepo };
});

vi.mock('../../container', () => ({ getRepos: () => ({ graph: fakeGraphRepo }) }));

import { graphRoutes } from '../graph';

import { realAuthenticate, setErrorHandler } from './helpers/app';

const BEARER = { authorization: 'Bearer test-token' };
let app: FastifyInstance;

beforeAll(async () => {
  nodes.clear();
  edges.clear();
  nodes.set('n1', { id: 'n1', userId: 'u1', label: 'Acme', type: 'entity' });

  app = Fastify();
  app.decorate('authenticate', realAuthenticate);
  setErrorHandler(app);
  await app.register(graphRoutes as never, { prefix: '/graph' });
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe('graph routes — authentication', () => {
  it('GET /graph without Bearer → 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/graph' });
    expect(res.statusCode).toBe(401);
  });

  it('POST /graph/ingest without Bearer → 401', async () => {
    const res = await app.inject({ method: 'POST', url: '/graph/ingest', payload: { text: 'x' } });
    expect(res.statusCode).toBe(401);
  });
});

describe('graph GET /graph — full graph', () => {
  it('returns nodes and edges for the user', async () => {
    const res = await app.inject({ method: 'GET', url: '/graph', headers: BEARER });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { nodes: { id: string }[]; edges: unknown[] };
    expect(body.nodes.some((n) => n.id === 'n1')).toBe(true);
  });
});

describe('graph POST /graph/ingest', () => {
  it('ingests text, extracts entities, returns 201 with counts', async () => {
    const res = await app.inject({
      method: 'POST', url: '/graph/ingest', headers: BEARER,
      payload: { text: 'Acme and Globex are partnering on the Apollo project.' },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json() as { documentNode: unknown; entityCount: number; edgeCount: number };
    expect(body.documentNode).toBeDefined();
    expect(typeof body.entityCount).toBe('number');
    expect(typeof body.edgeCount).toBe('number');
  });

  it('accepts optional sourceId/sourceLabel', async () => {
    const res = await app.inject({
      method: 'POST', url: '/graph/ingest', headers: BEARER,
      payload: { text: 'Hello world', sourceId: 'src-1', sourceLabel: 'note' },
    });
    expect(res.statusCode).toBe(201);
  });
});

describe('graph GET /graph/:id — neighborhood', () => {
  it('returns the neighborhood for an existing node', async () => {
    const res = await app.inject({ method: 'GET', url: '/graph/n1', headers: BEARER });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { center: { id: string } };
    expect(body.center.id).toBe('n1');
  });

  it('accepts a depth query parameter', async () => {
    const res = await app.inject({ method: 'GET', url: '/graph/n1?depth=2', headers: BEARER });
    expect(res.statusCode).toBe(200);
  });

  it('returns 404 for a missing node', async () => {
    const res = await app.inject({ method: 'GET', url: '/graph/missing', headers: BEARER });
    expect(res.statusCode).toBe(404);
  });
});

describe('graph DELETE /graph/:id', () => {
  it('deletes an existing node and returns ok', async () => {
    const res = await app.inject({ method: 'DELETE', url: '/graph/n1', headers: BEARER });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
  });

  it('returns 404 for a missing node', async () => {
    const res = await app.inject({ method: 'DELETE', url: '/graph/missing', headers: BEARER });
    expect(res.statusCode).toBe(404);
  });
});
