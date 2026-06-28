import { ScrollText } from 'lucide-react';

import { PageHeader } from '@/components/common/page-header';
import { PageContent, PageShell } from '@/components/common/page-shell';
import { LogsPageClient } from '@/components/logs/logs-page-client';

export default function LogsPage() {
  return (
    <PageShell>
      <PageHeader
        title="Logs"
        description="Worker logs and audit trail"
        icon={<ScrollText className="h-6 w-6" />}
      />
      <PageContent className="overflow-hidden">
        <LogsPageClient />
      </PageContent>
    </PageShell>
  );
}
