'use client';

import { Workflow } from 'lucide-react';
import dynamic from 'next/dynamic';

import { PageHeader } from '@/components/common/page-header';
import { PageContent, PageShell } from '@/components/common/page-shell';
import { Skeleton } from '@/components/ui/skeleton';

// D3 is client-only (lazy inside GraphCanvas too) — keep the wrapper out of
// the initial bundle for non-/graph routes.
const GraphView = dynamic(
  () => import('@/components/graph/graph-view').then((m) => m.GraphView),
  { ssr: false, loading: () => <Skeleton className="h-full w-full" /> },
);

export default function GraphPage() {
  return (
    <PageShell>
      <PageHeader
        title="Graph"
        description="Knowledge graph — explore connections between documents, entities and concepts."
        icon={<Workflow className="h-6 w-6" />}
      />
      <PageContent className="overflow-hidden">
        <GraphView />
      </PageContent>
    </PageShell>
  );
}
