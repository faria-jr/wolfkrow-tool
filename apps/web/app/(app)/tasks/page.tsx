import { PageHeader } from '@/components/common/page-header';
import { TasksPageTabs } from '@/components/tasks/tasks-page-tabs';

export default function TasksPage() {
  return (
    <div className="flex flex-col gap-4 p-4">
      <PageHeader title="Tasks" description="Personal task management" />
      <TasksPageTabs />
    </div>
  );
}
