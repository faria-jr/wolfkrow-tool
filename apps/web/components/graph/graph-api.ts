/**
 * Thin graph API client — isolates fetch calls so the data hook stays small.
 * All routes are same-origin (the BFF forwards the auth cookie to the worker).
 */

import type { GraphNeighborhood, GraphSnapshot } from './types';

export interface IngestResponse {
  entityCount: number;
  edgeCount: number;
}

export async function fetchGraph(): Promise<GraphSnapshot> {
  const res = await fetch('/api/graph');
  if (!res.ok) throw new Error(`load failed (${res.status})`);
  return (await res.json()) as GraphSnapshot;
}

export async function fetchNeighborhood(nodeId: string): Promise<GraphNeighborhood | null> {
  const res = await fetch(`/api/graph/${nodeId}?depth=1`);
  if (!res.ok) return null;
  return (await res.json()) as GraphNeighborhood;
}

export async function postIngest(text: string): Promise<IngestResponse> {
  const res = await fetch('/api/graph/ingest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error(`ingest failed (${res.status})`);
  return (await res.json()) as IngestResponse;
}

export async function deleteNode(nodeId: string): Promise<number> {
  const res = await fetch(`/api/graph/${nodeId}`, { method: 'DELETE' });
  return res.status;
}
