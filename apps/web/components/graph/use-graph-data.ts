'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

import { deleteNode, fetchGraph, fetchNeighborhood, postIngest } from './graph-api';
import type { GraphEdge, GraphNeighborhood, GraphNode, GraphSnapshot } from './types';

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  loading: boolean;
  selected: GraphNode | null;
  setSelected: (node: GraphNode | null) => void;
  neighborhood: GraphNeighborhood | null;
  loadingNeighborhood: boolean;
  text: string;
  setText: (v: string) => void;
  ingesting: boolean;
  ingest: () => Promise<void>;
  remove: (node: GraphNode) => Promise<void>;
}

const EMPTY: GraphSnapshot = { nodes: [], edges: [] };

function useGraphSnapshot() {
  const [snap, setSnap] = useState<GraphSnapshot>(EMPTY);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setSnap(await fetchGraph());
    } catch (err) {
      toast.error('Failed to load graph', { description: (err as Error).message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { nodes: snap.nodes, edges: snap.edges, loading, reload };
}

function useGraphNeighborhood(selected: GraphNode | null) {
  const [neighborhood, setNeighborhood] = useState<GraphNeighborhood | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selected) {
      setNeighborhood(null);
      return;
    }
    setLoading(true);
    fetchNeighborhood(selected.id)
      .then(setNeighborhood)
      .catch(() => setNeighborhood(null))
      .finally(() => setLoading(false));
  }, [selected]);

  return { neighborhood, loading };
}

/** Ingest + delete mutations for the Graph page (toast feedback + reload). */
function useGraphMutations(
  reload: () => Promise<void>,
  clearSelection: () => void
) {
  const [text, setText] = useState('');
  const [ingesting, setIngesting] = useState(false);

  const ingest = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setIngesting(true);
    try {
      const { entityCount, edgeCount } = await postIngest(trimmed);
      toast.success('Graph updated', {
        description: `${entityCount} entities · ${edgeCount} edges`,
      });
      setText('');
      await reload();
    } catch (err) {
      toast.error('Ingest failed', { description: (err as Error).message });
    } finally {
      setIngesting(false);
    }
  }, [text, reload]);

  const remove = useCallback(
    async (node: GraphNode) => {
      try {
        const status = await deleteNode(node.id);
        if (status !== 200 && status !== 404) throw new Error(`delete failed (${status})`);
        toast.success('Node deleted');
        clearSelection();
        await reload();
      } catch (err) {
        toast.error('Delete failed', { description: (err as Error).message });
      }
    },
    [reload, clearSelection]
  );

  return { text, setText, ingesting, ingest, remove };
}

/** Owns all graph state + server interactions for the Graph page. */
export function useGraphData(): GraphData {
  const { nodes, edges, loading, reload } = useGraphSnapshot();
  const [selected, setSelected] = useState<GraphNode | null>(null);
  const { neighborhood, loading: loadingNeighborhood } = useGraphNeighborhood(selected);
  const clearSelection = useCallback(() => setSelected(null), []);
  const { text, setText, ingesting, ingest, remove } = useGraphMutations(reload, clearSelection);

  return {
    nodes,
    edges,
    loading,
    selected,
    setSelected,
    neighborhood,
    loadingNeighborhood,
    text,
    setText,
    ingesting,
    ingest,
    remove,
  };
}
