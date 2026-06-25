import { PageContent, PageShell } from '@/components/common/page-shell';
import { EnrichView } from '@/components/enrich/enrich-view';

// EnrichView renders its own header (text-2xl "Enrich"); PageShell provides the
// canonical frame without a duplicate PageHeader.
export const metadata = { title: 'Enrich' };

export default function EnrichPage() {
  return (
    <PageShell>
      <PageContent>
        <EnrichView />
      </PageContent>
    </PageShell>
  );
}
