import { LogViewer } from '@/components/logs/log-viewer';

export default function LogsPage() {
  return (
    <div className="flex h-full flex-col gap-4 p-4">
      <div>
        <h1 className="text-xl font-semibold">Logs</h1>
        <p className="text-sm text-muted-foreground">Live worker log stream</p>
      </div>
      <div className="flex-1">
        <LogViewer />
      </div>
    </div>
  );
}
