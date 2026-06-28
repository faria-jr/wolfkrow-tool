'use client';

import { Network, Trash2 } from 'lucide-react';

import type { GraphNeighborhood, GraphNode, NodeType } from './types';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

export interface GraphSidePanelProps {
  selected: GraphNode | null;
  neighborhood: GraphNeighborhood | null;
  loadingNeighborhood?: boolean;
  onDelete?: (node: GraphNode) => void;
}

const TYPE_LABEL: Record<NodeType, string> = {
  document: 'Document',
  entity: 'Entity',
  concept: 'Concept',
  memory: 'Memory',
};

export function GraphSidePanel({
  selected,
  neighborhood,
  loadingNeighborhood,
  onDelete,
}: GraphSidePanelProps) {
  if (!selected) {
    return (
      <div className="text-muted-foreground flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-sm">
        <Network className="h-8 w-8 opacity-40" />
        <p>Select a node to inspect its connections and source.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-3 p-4">
      <NodeHeader node={selected} onDelete={onDelete} />
      <NodeMeta node={selected} />
      <NodeConnections neighbors={neighborhood?.neighbors ?? []} loading={loadingNeighborhood} />
    </div>
  );
}

function NodeHeader({
  node,
  onDelete,
}: {
  node: GraphNode;
  onDelete: ((node: GraphNode) => void) | undefined;
}) {
  return (
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">{node.label}</p>
        <Badge variant="secondary" className="mt-1">
          {TYPE_LABEL[node.type] ?? node.type}
        </Badge>
      </div>
      {onDelete && (
        <Button size="icon" variant="ghost" aria-label="Delete node" onClick={() => onDelete(node)}>
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

function NodeMeta({ node }: { node: GraphNode }) {
  return (
    <dl className="grid grid-cols-3 gap-1 text-xs">
      <dt className="text-muted-foreground">Source</dt>
      <dd className="col-span-2 truncate font-mono">{node.sourceId ?? '—'}</dd>
      <dt className="text-muted-foreground">Created</dt>
      <dd className="col-span-2 truncate">{new Date(node.createdAt).toLocaleString()}</dd>
    </dl>
  );
}

function NodeConnections({
  neighbors,
  loading,
}: {
  neighbors: GraphNode[];
  loading: boolean | undefined;
}) {
  return (
    <div className="mt-2 min-h-0 flex-1">
      <p className="text-muted-foreground mb-1 text-xs font-medium uppercase">
        Connections ({neighbors.length})
      </p>
      <ScrollArea className="border-border h-[calc(100%-1.25rem)] rounded-md border">
        <ul className="divide-border divide-y">
          {loading && <li className="text-muted-foreground p-2 text-xs">Loading…</li>}
          {!loading && neighbors.length === 0 && (
            <li className="text-muted-foreground p-2 text-xs">No connections.</li>
          )}
          {!loading &&
            neighbors.map((n) => (
              <li key={n.id} className="flex items-center justify-between p-2 text-xs">
                <span className="truncate">{n.label}</span>
                <Badge variant="outline" className="ml-2 shrink-0">
                  {TYPE_LABEL[n.type] ?? n.type}
                </Badge>
              </li>
            ))}
        </ul>
      </ScrollArea>
    </div>
  );
}

export default GraphSidePanel;
