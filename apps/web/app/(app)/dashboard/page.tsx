import { PageContent, PageShell } from '@/components/common/page-shell';
import { DashboardView } from '@/components/dashboard/dashboard-view';

export default function DashboardPage() {
  return (
    <PageShell>
      <PageContent>
        <DashboardView />
      </PageContent>
    </PageShell>
  );
}
