import { GraphView } from '@/components/graph/graph-view';

// GraphView is a client component; D3 is lazy-loaded inside GraphCanvas
// via dynamic import, so it stays out of the initial bundle (SPEC-022 §4).
export default function GraphPage() {
  return (
    <div className="flex flex-col gap-4 p-4">
      <div>
        <h1 className="text-xl font-semibold">Graph</h1>
        <p className="text-sm text-muted-foreground">
          Knowledge graph — explore connections between documents, entities and concepts.
        </p>
      </div>
      <GraphView />
    </div>
  );
}
