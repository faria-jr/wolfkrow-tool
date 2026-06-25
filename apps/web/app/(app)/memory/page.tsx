import { BrainCircuit } from 'lucide-react';

import { PageHeader } from '@/components/common/page-header';
import { PageContent, PageShell } from '@/components/common/page-shell';
import { MemoryView } from '@/components/memory/memory-view';

export const metadata = { title: 'Memory — Wolfkrow' };

export default function MemoryPage() {
  return (
    <PageShell>
      <PageHeader title="Memory" description="Long-term agent memory and dreaming consolidation." icon={<BrainCircuit className="h-6 w-6" />} />
      <PageContent>
        <MemoryView />
      </PageContent>
    </PageShell>
  );
}
