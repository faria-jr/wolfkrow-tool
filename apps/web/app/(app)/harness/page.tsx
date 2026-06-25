import { Wrench } from 'lucide-react';

import { PageHeader } from '@/components/common/page-header';
import { PageContent, PageShell } from '@/components/common/page-shell';
import { HarnessView } from '@/components/harness/harness-view';

export const metadata = { title: 'Harness — Wolfkrow' };

export default function HarnessPage() {
  return (
    <PageShell>
      <PageHeader
        title="Harness"
        description="Run tools and test agent behavior in a controlled environment."
        icon={<Wrench className="h-6 w-6" />}
      />
      <PageContent>
        <HarnessView />
      </PageContent>
    </PageShell>
  );
}
