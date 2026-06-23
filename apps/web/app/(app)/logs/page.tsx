import { LogsPageClient } from '@/components/logs/logs-page-client';

export default function LogsPage() {
  return (
    <div className="flex h-full flex-col gap-4 p-4">
      <div>
        <h1 className="text-xl font-semibold">Logs</h1>
        <p className="text-sm text-muted-foreground">Worker logs and audit trail</p>
      </div>
      <div className="flex-1 overflow-hidden">
        <LogsPageClient />
      </div>
    </div>
  );
}
