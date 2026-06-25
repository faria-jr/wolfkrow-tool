import { Workflow } from 'lucide-react';

import { PageHeader } from '@/components/common/page-header';
import { PageContent, PageShell } from '@/components/common/page-shell';
import { GraphView } from '@/components/graph/graph-view';

// GraphView is a client component; D3 is lazy-loaded inside GraphCanvas
// via dynamic import, so it stays out of the initial bundle (SPEC-022 §4).
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
