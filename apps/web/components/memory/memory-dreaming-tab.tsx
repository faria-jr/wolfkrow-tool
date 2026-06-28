'use client';

import { Moon } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

import type { CompactionLogData, DreamingStatus } from './memory-types';

import { ErrorState } from '@/components/common/error-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

interface DreamingApi {
  status: DreamingStatus | null;
  history: CompactionLogData[];
}

export function MemoryDreamingTab() {
  const [status, setStatus] = useState<DreamingStatus | null>(null);
  const [history, setHistory] = useState<CompactionLogData[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [triggering, setTriggering] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await fetchDreaming();
      setStatus(data.status);
      setHistory(data.history);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
      setHistory([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const trigger = useCallback(async () => {
    setTriggering(true);
    try {
      const res = await fetch('/api/memory/dreaming/trigger', {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        toast.success('Dreaming triggered');
        await load();
      } else {
        toast.error('Failed to trigger dreaming');
      }
    } finally {
      setTriggering(false);
    }
  }, [load]);

  if (error)
    return <ErrorState title="Failed to load dreaming" description={error} onRetry={load} />;
  if (history === null) return <Skeleton className="h-40 w-full" />;

  return (
    <DreamingBody status={status} history={history} triggering={triggering} onTrigger={trigger} />
  );
}

async function fetchDreaming(): Promise<DreamingApi> {
  const [s, h] = await Promise.all([
    fetch('/api/memory/dreaming/status', { credentials: 'include' }).then(
      (r) => r.json() as Promise<{ status: DreamingStatus | null }>
    ),
    fetch('/api/memory/dreaming/history', { credentials: 'include' }).then(
      (r) => r.json() as Promise<{ log: CompactionLogData[] }>
    ),
  ]);
  return { status: s.status ?? null, history: h.log ?? [] };
}

function DreamingBody({
  status,
  history,
  triggering,
  onTrigger,
}: {
  status: DreamingStatus | null;
  history: CompactionLogData[];
  triggering: boolean;
  onTrigger: () => void;
}) {
  const idleMin = status ? Math.round(status.idleThresholdMs / 60_000) : 5;
  return (
    <div className="space-y-4">
      <div className="bg-muted/30 flex items-center justify-between rounded-lg border p-4">
        <div className="flex items-center gap-3">
          <Moon className="text-primary h-5 w-5" />
          <div>
            <p className="text-sm font-medium">Dreaming {status?.active ? 'active' : 'inactive'}</p>
            <p className="text-muted-foreground text-xs">
              Consolidates memories after {idleMin} min idle.{' '}
              {status?.lastActivityAt
                ? `Last activity: ${new Date(status.lastActivityAt).toLocaleString()}`
                : 'No activity yet.'}
            </p>
          </div>
        </div>
        <Button size="sm" onClick={onTrigger} disabled={triggering}>
          {triggering ? 'Dreaming…' : 'Dream now'}
        </Button>
      </div>

      {history.length === 0 ? (
        <p className="text-muted-foreground py-8 text-center text-sm">
          No dreaming runs recorded yet.
        </p>
      ) : (
        <ul className="space-y-2">
          {history.map((log) => (
            <li key={log.id} className="flex items-center justify-between rounded-lg border p-3">
              <div className="min-w-0">
                <p className="truncate text-sm">{log.summary ?? `Dreaming run (${log.trigger})`}</p>
                <p className="text-muted-foreground text-xs">
                  {new Date(log.createdAt).toLocaleString()}
                </p>
              </div>
              <Badge variant="outline">{log.trigger}</Badge>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
