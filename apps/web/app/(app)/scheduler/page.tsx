import { PageContent, PageShell } from '@/components/common/page-shell';
import { SchedulerView } from '@/components/scheduler/scheduler-view';

// SchedulerView renders its own header (text-2xl "Scheduler"); PageShell
// provides the canonical frame without a duplicate PageHeader.
export const metadata = { title: 'Scheduler — Wolfkrow' };

export default function SchedulerPage() {
  return (
    <PageShell>
      <PageContent>
        <SchedulerView />
      </PageContent>
    </PageShell>
  );
}
