import { PageContent, PageShell } from '@/components/common/page-shell';
import { MemoryView } from '@/components/memory/memory-view';

// MemoryView renders its own header (text-2xl "Memory"); PageShell provides
// the canonical frame without a duplicate PageHeader.
export const metadata = { title: 'Memory — Wolfkrow' };

export default function MemoryPage() {
  return (
    <PageShell>
      <PageContent>
        <MemoryView />
      </PageContent>
    </PageShell>
  );
}
