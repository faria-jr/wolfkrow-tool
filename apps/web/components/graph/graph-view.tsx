'use client';

import { GraphCanvas } from './GraphCanvas';
import { GraphSidePanel } from './GraphSidePanel';
import type { GraphEdge, GraphNode } from './types';
import { useGraphData } from './use-graph-data';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';


export function GraphView() {
  const g = useGraphData();

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
      <div className="flex flex-col gap-4">
        <IngestCard text={g.text} setText={g.setText} ingesting={g.ingesting} onIngest={g.ingest} />
        <GraphBoard
          nodes={g.nodes}
          edges={g.edges}
          loading={g.loading}
          selectedId={g.selected?.id ?? null}
          onSelect={g.setSelected}
        />
      </div>
      <Card className="h-fit lg:sticky lg:top-4">
        <GraphSidePanel
          selected={g.selected}
          neighborhood={g.neighborhood}
          loadingNeighborhood={g.loadingNeighborhood}
          onDelete={g.remove}
        />
      </Card>
    </div>
  );
}

function IngestCard({
  text,
  setText,
  ingesting,
  onIngest,
}: {
  text: string;
  setText: (v: string) => void;
  ingesting: boolean;
  onIngest: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Ingest text</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <Textarea
          aria-label="Text to ingest"
          placeholder="Paste text to extract entities and relations…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
        />
        <div className="flex justify-end">
          <Button onClick={() => onIngest()} disabled={ingesting || !text.trim()}>
            {ingesting ? 'Ingesting…' : 'Ingest'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function GraphBoard({
  nodes,
  edges,
  loading,
  selectedId,
  onSelect,
}: {
  nodes: GraphNode[];
  edges: GraphEdge[];
  loading: boolean;
  selectedId: string | null;
  onSelect: (node: GraphNode | null) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">
          Knowledge Graph{' '}
          <span className="text-muted-foreground">
            ({nodes.length} nodes · {edges.length} edges)
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-[560px] w-full rounded-lg" />
        ) : nodes.length === 0 ? (
          <div className="flex h-[560px] items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
            No nodes yet. Ingest text to build the graph.
          </div>
        ) : (
          <GraphCanvas nodes={nodes} edges={edges} selectedId={selectedId} onSelect={onSelect} />
        )}
      </CardContent>
    </Card>
  );
}

export default GraphView;
