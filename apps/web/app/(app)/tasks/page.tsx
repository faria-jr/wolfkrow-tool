import { TasksPageTabs } from '@/components/tasks/tasks-page-tabs';

export default function TasksPage() {
  return (
    <div className="flex flex-col gap-4 p-4">
      <div>
        <h1 className="text-xl font-semibold">Tasks</h1>
        <p className="text-sm text-muted-foreground">Personal task management</p>
      </div>
      <TasksPageTabs />
    </div>
  );
}
