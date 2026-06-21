import * as schema from '@wolfkrow/infra/db/schema';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';



import {
  buildEntities,
  computeCooccurrence,
  extractKeyPhrases,
  extractProperNouns,
  extractTechTerms,
  findFirstPosition,
  GraphIngest,
  tokenize,
} from '../knowledge/graph-ingest';
import { MGraph } from '../knowledge/mgraph';
import type { createServer } from '../server';

/** Build an isolated in-memory MGraph (no eager DB, no file on disk). */
function makeGraph(): MGraph {
  const sqlite = new Database(':memory:');
  // Only the graph tables are needed; FKs are off by default in better-sqlite3,
  // so graph rows can reference arbitrary user ids.
  sqlite.exec(`
    CREATE TABLE graph_nodes (
      id text PRIMARY KEY NOT NULL,
      user_id text NOT NULL,
      label text NOT NULL,
      type text NOT NULL,
      source_id text,
      created_at integer NOT NULL
    );
    CREATE TABLE graph_edges (
      id text PRIMARY KEY NOT NULL,
      user_id text NOT NULL,
      source_node_id text NOT NULL,
      target_node_id text NOT NULL,
      relation text NOT NULL,
      weight real NOT NULL,
      created_at integer NOT NULL
    );
  `);
  const db = drizzle(sqlite, { schema });
  return new MGraph(db);
}

describe('graph-ingest extraction (pure)', () => {
  it('extracts proper nouns incl. sentence-initial, skipping stop words', () => {
    const nouns = extractProperNouns('Alice met Bob in Paris.');
    expect(nouns).toContain('Alice');
    expect(nouns).toContain('Bob');
    expect(nouns).toContain('Paris');
    // stop word 'in' is excluded
    expect(nouns.map((n) => n.toLowerCase())).not.toContain('in');
  });

  it('extracts tech terms case-sensitively', () => {
    const terms = extractTechTerms('We use REST and GraphQL over HTTP.');
    expect(terms).toEqual(expect.arrayContaining(['REST', 'GraphQL', 'HTTP']));
  });

  it('extracts 2-word key phrases excluding stop words', () => {
    const phrases = extractKeyPhrases('machine learning rocks');
    expect(phrases).toContain('machine learning');
  });

  it('tokenizes to lowercased alnum tokens', () => {
    expect(tokenize('Hello, WORLD! hello')).toEqual(['hello', 'world', 'hello']);
  });

  it('finds first position of single and multi-word labels', () => {
    const toks = ['a', 'b', 'c', 'd'];
    expect(findFirstPosition(toks, 'b')).toBe(1);
    expect(findFirstPosition(toks, 'b c')).toBe(1);
    expect(findFirstPosition(toks, 'zzz')).toBe(-1);
  });

  it('buildEntities assigns positions and dedups case-insensitively', () => {
    const ents = buildEntities('GraphQL and graphql are great. REST too.');
    const labels = ents.map((e) => e.label.toLowerCase());
    expect(labels.filter((l) => l === 'graphql').length).toBe(1);
    const gql = ents.find((e) => e.label.toLowerCase() === 'graphql');
    expect(gql?.position).toBeGreaterThanOrEqual(0);
  });
});

describe('computeCooccurrence (text proximity)', () => {
  it('connects entities within window using token distance', () => {
    // positions: graphql=0, rest=3 → distance 3 (within window 8)
    const ents = buildEntities('GraphQL powers the new REST service');
    const pairs = computeCooccurrence(ents, 8);
    const labels = pairs.map((p) => [p.a.toLowerCase(), p.b.toLowerCase()].sort());
    expect(labels.some(([a, b]) => a === 'graphql' && b === 'rest')).toBe(true);
  });

  it('does not connect entities farther than the window', () => {
    // build synthetic entities with far positions
    const ents = [
      { label: 'Alpha', type: 'entity' as const, position: 0 },
      { label: 'Omega', type: 'entity' as const, position: 100 },
    ];
    expect(computeCooccurrence(ents, 8)).toHaveLength(0);
  });

  it('weight is inverse distance', () => {
    const ents = [
      { label: 'A', type: 'entity' as const, position: 0 },
      { label: 'B', type: 'entity' as const, position: 2 },
    ];
    const [pair] = computeCooccurrence(ents, 8);
    expect(pair?.weight).toBeCloseTo(0.5);
  });
});

describe('GraphIngest.ingest', () => {
  it('persists document + entity nodes and returns honest edgeCount', () => {
    const graph = makeGraph();
    const ingest = new GraphIngest(graph);
    const text = 'GraphQL and REST communicate over HTTP with OAuth tokens.';
    const res = ingest.ingest({ userId: 'u1', text });

    expect(res.documentNode.type).toBe('document');
    expect(res.entityNodes.length).toBeGreaterThan(0);

    // edgeCount must equal mentions + co-occurs actually persisted for the doc.
    const allEdges = graph.listEdges('u1');
    const incident = allEdges.filter(
      (e) => e.sourceNodeId === res.documentNode.id || e.targetNodeId === res.documentNode.id,
    );
    const mentions = incident.filter((e) => e.relation === 'mentions');
    expect(mentions.length).toBe(res.entityNodes.length);
    // edgeCount must reflect actually persisted edges (mentions + co-occurs),
    // not the previous bogus 2n-1 formula.
    expect(res.edgeCount).toBe(allEdges.length);
  });

  it('entity nodes carry sourceId back-referencing the document node', () => {
    const graph = makeGraph();
    const res = new GraphIngest(graph).ingest({ userId: 'u1', text: 'GraphQL API.' });
    for (const node of res.entityNodes) {
      expect(node.sourceId).toBe(res.documentNode.id);
    }
  });

  it('idempotent: re-ingesting same text does not duplicate nodes', () => {
    const graph = makeGraph();
    const text = 'GraphQL API with REST.';
    new GraphIngest(graph).ingest({ userId: 'u1', text });
    const firstCount = graph.listNodes('u1').length;
    new GraphIngest(graph).ingest({ userId: 'u1', text });
    expect(graph.listNodes('u1').length).toBe(firstCount);
  });
});

describe('MGraph persistence + neighborhood', () => {
  it('upsertNode is idempotent by (userId,label,type)', () => {
    const g = makeGraph();
    const a = g.upsertNode({ userId: 'u1', label: 'X', type: 'entity' });
    const b = g.upsertNode({ userId: 'u1', label: 'X', type: 'entity' });
    expect(a.id).toBe(b.id);
    expect(g.listNodes('u1').length).toBe(1);
  });

  it('isolates tenants by userId', () => {
    const g = makeGraph();
    g.upsertNode({ userId: 'u1', label: 'X', type: 'entity' });
    g.upsertNode({ userId: 'u2', label: 'Y', type: 'entity' });
    expect(g.listNodes('u1').map((n) => n.label)).toEqual(['X']);
    expect(g.listNodes('u2').map((n) => n.label)).toEqual(['Y']);
  });

  it('neighborhood returns center + 1-hop neighbors + edges', () => {
    const g = makeGraph();
    const doc = g.upsertNode({ userId: 'u1', label: 'doc', type: 'document' });
    const e1 = g.upsertNode({ userId: 'u1', label: 'E1', type: 'entity' });
    const e2 = g.upsertNode({ userId: 'u1', label: 'E2', type: 'entity' });
    g.upsertEdge({ userId: 'u1', sourceNodeId: doc.id, targetNodeId: e1.id, relation: 'mentions' });
    g.upsertEdge({ userId: 'u1', sourceNodeId: doc.id, targetNodeId: e2.id, relation: 'mentions' });

    const nb = g.neighborhood('u1', doc.id, 1);
    expect(nb?.center.id).toBe(doc.id);
    expect(nb?.neighbors.map((n) => n.label).sort()).toEqual(['E1', 'E2']);
    expect(nb?.edges.length).toBe(2);
  });

  it('neighborhood depth=2 reaches second hop', () => {
    const g = makeGraph();
    const a = g.upsertNode({ userId: 'u1', label: 'A', type: 'entity' });
    const b = g.upsertNode({ userId: 'u1', label: 'B', type: 'entity' });
    const c = g.upsertNode({ userId: 'u1', label: 'C', type: 'entity' });
    g.upsertEdge({ userId: 'u1', sourceNodeId: a.id, targetNodeId: b.id });
    g.upsertEdge({ userId: 'u1', sourceNodeId: b.id, targetNodeId: c.id });

    const nb = g.neighborhood('u1', a.id, 1);
    expect(nb?.neighbors.map((n) => n.label)).toEqual(['B']);
    const nb2 = g.neighborhood('u1', a.id, 2);
    expect(nb2?.neighbors.map((n) => n.label).sort()).toEqual(['B', 'C']);
  });

  it('neighborhood returns null for unknown node', () => {
    const g = makeGraph();
    expect(g.neighborhood('u1', 'nope', 1)).toBeNull();
  });

  it('expand delegates to neighborhood (SPEC-022 ExpandNode)', () => {
    const g = makeGraph();
    const a = g.upsertNode({ userId: 'u1', label: 'A', type: 'entity' });
    expect(g.expand('u1', a.id, 1)?.center.id).toBe(a.id);
    expect(g.expand('u1', 'missing', 1)).toBeNull();
  });

  it('deleteNode cascades edges and reports existence', () => {
    const g = makeGraph();
    const doc = g.upsertNode({ userId: 'u1', label: 'doc', type: 'document' });
    const e = g.upsertNode({ userId: 'u1', label: 'E', type: 'entity' });
    g.upsertEdge({ userId: 'u1', sourceNodeId: doc.id, targetNodeId: e.id, relation: 'mentions' });

    expect(g.deleteNode('u1', 'missing')).toBe(false);
    expect(g.deleteNode('u1', doc.id)).toBe(true);
    expect(g.getNode('u1', doc.id)).toBeNull();
    // edge referencing deleted node is gone too
    expect(g.listEdges('u1').length).toBe(0);
  });
});

describe('graph routes auth', () => {
  // Lazily build the server; config may need JWKS_URL but the missing-token
  // path returns 401 before any JWKS lookup, so no network is required.
  let app: Awaited<ReturnType<typeof createServer>> | null = null;
  beforeAll(async () => {
    const { createServer } = await import('../server');
    app = await createServer();
    await app.ready();
  });
  afterAll(async () => {
    await app?.close();
  });

  it('GET /graph without token → 401', async () => {
    const res = await app!.inject({ method: 'GET', url: '/graph' });
    expect(res.statusCode).toBe(401);
  });

  it('POST /graph/ingest without token → 401', async () => {
    const res = await app!.inject({
      method: 'POST',
      url: '/graph/ingest',
      payload: { text: 'x' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('DELETE /graph/:id without token → 401', async () => {
    const res = await app!.inject({ method: 'DELETE', url: '/graph/abc' });
    expect(res.statusCode).toBe(401);
  });
});
