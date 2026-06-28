import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Stub the D3 canvas so the smoke test stays deterministic in jsdom.
vi.mock('@/components/graph/GraphCanvas', () => ({
  GraphCanvas: ({
    nodes,
    edges,
    selectedId,
  }: {
    nodes: { id: string }[];
    edges: unknown[];
    selectedId?: string | null;
  }) => (
    <div
      data-testid="graph-canvas"
      data-nodes={nodes.length}
      data-edges={edges.length}
      data-selected={selectedId ?? ''}
    />
  ),
}));

// Stub sonner toasts (no DOM portal needed).
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { GraphView } from '../graph-view';
import type { GraphSnapshot } from '../types';

const SNAPSHOT: GraphSnapshot = {
  nodes: [
    {
      id: 'n1',
      userId: 'u1',
      label: 'doc',
      type: 'document',
      sourceId: null,
      createdAt: '2024-01-01T00:00:00.000Z',
    },
    {
      id: 'n2',
      userId: 'u1',
      label: 'GraphQL',
      type: 'concept',
      sourceId: 'n1',
      createdAt: '2024-01-01T00:00:00.000Z',
    },
  ],
  edges: [
    {
      id: 'e1',
      userId: 'u1',
      sourceNodeId: 'n1',
      targetNodeId: 'n2',
      relation: 'mentions',
      weight: 1,
      createdAt: '2024-01-01T00:00:00.000Z',
    },
  ],
};

const INGEST_BODY = JSON.stringify({
  documentNode: SNAPSHOT.nodes[0],
  entityCount: 1,
  edgeCount: 1,
});

/** Resolve a (url, method) pair to a mock Response body + status. */
function route(url: string, method: string): { body: string; status: number } {
  if (url === '/api/graph' && method === 'GET') {
    return { body: JSON.stringify(SNAPSHOT), status: 200 };
  }
  if (url.startsWith('/api/graph/ingest')) return { body: INGEST_BODY, status: 201 };
  return { body: '{}', status: 200 };
}

function toUrl(input: RequestInfo | URL | undefined): string {
  if (typeof input === 'string') return input;
  if (input && typeof input === 'object' && 'url' in input) return String((input as Request).url);
  return String(input ?? '');
}

function mockFetch() {
  const fetchMock = vi.fn(async (input: RequestInfo | URL | undefined, init?: RequestInit) => {
    const url = toUrl(input);
    const method = init?.method ?? 'GET';
    const { body, status } = route(url, method);
    return new Response(body, { status });
  });
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

describe('GraphView (smoke)', () => {
  beforeEach(() => mockFetch());
  afterEach(() => vi.restoreAllMocks());

  it('loads and renders the graph snapshot with counts', async () => {
    render(<GraphView />);
    await waitFor(() => {
      expect(screen.getByText(/Knowledge Graph/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/2 nodes · 1 edges/i)).toBeInTheDocument();
    expect(screen.getByTestId('graph-canvas')).toHaveAttribute('data-nodes', '2');
  });

  it('shows the ingest button', async () => {
    render(<GraphView />);
    expect(await screen.findByRole('button', { name: /ingest/i })).toBeInTheDocument();
  });
});
