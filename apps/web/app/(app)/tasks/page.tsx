import { PageHeader } from '@/components/common/page-header';
import { PageContent, PageShell } from '@/components/common/page-shell';
import { TasksPageTabs } from '@/components/tasks/tasks-page-tabs';

export default function TasksPage() {
  return (
    <PageShell>
      <PageHeader title="Tasks" description="Personal task management" />
      <PageContent>
        <TasksPageTabs />
      </PageContent>
    </PageShell>
  );
}
