import dynamic from 'next/dynamic';

import { Skeleton } from '@/components/ui/skeleton';

// Graph UI + D3 are client-only and lazy-loaded (SPEC-022 §4).
const GraphView = dynamic(() => import('@/components/graph/graph-view'), {
  ssr: false,
  loading: () => <Skeleton className="h-[600px] w-full rounded-lg" />,
});

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
