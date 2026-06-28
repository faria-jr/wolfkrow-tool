'use client';

import { Camera, Loader2, Lock, Palette, Play, Square } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';

type StudioStatus = 'stopped' | 'starting' | 'running' | 'crashed' | 'unknown';

const POLL_MS = 3000;

interface StudioState {
  status: StudioStatus;
  webUrl: string | null;
}

const STATUS_COLOR: Record<StudioStatus, string> = {
  running: 'text-green-500',
  starting: 'text-yellow-500',
  stopped: 'text-gray-500',
  crashed: 'text-red-500',
  unknown: 'text-gray-400',
};

interface DesignStudioProps {
  overrideUrl?: string;
  projectId?: string;
}

export function DesignStudio({ overrideUrl, projectId }: DesignStudioProps) {
  const studio = useOpenDesign(overrideUrl);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const actions = useDesignActions(projectId);

  return (
    <div className="flex h-full flex-col gap-3">
      <DesignStudioToolbar actions={actions} projectId={projectId} studio={studio} />
      <StudioFrame studio={studio} iframeRef={iframeRef} />
    </div>
  );
}

function useDesignActions(projectId?: string) {
  const [snapshotting, setSnapshotting] = useState(false);
  const [locking, setLocking] = useState(false);

  const captureSnapshot = async () => {
    if (!projectId) return;
    setSnapshotting(true);
    try {
      const res = await fetch('/api/open-design/snapshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ odProjectId: projectId }),
      });
      if (res.ok) {
        toast.success('Design snapshot captured successfully!');
      } else {
        toast.error('Failed to capture snapshot');
      }
    } catch {
      toast.error('Error capturing snapshot');
    } finally {
      setSnapshotting(false);
    }
  };

  const lockDesign = async () => {
    if (!projectId) return;
    setLocking(true);
    try {
      const res = await fetch('/api/open-design/lock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          odProjectId: projectId,
          outputDir: './apps/web/components/design-export',
        }),
      });
      if (res.ok) {
        toast.success('Design locked and code generated successfully!');
      } else {
        toast.error('Failed to lock design');
      }
    } catch {
      toast.error('Error locking design');
    } finally {
      setLocking(false);
    }
  };

  return { captureSnapshot, lockDesign, locking, snapshotting };
}

type DesignActions = ReturnType<typeof useDesignActions>;

async function fetchStudioStatus(): Promise<{
  status: StudioStatus;
  webUrl: string | null;
} | null> {
  try {
    const res = await fetch('/api/open-design');
    if (!res.ok) return null;
    const data = (await res.json()) as { state?: { status: StudioStatus; webUrl: string | null } };
    return { status: data.state?.status ?? 'unknown', webUrl: data.state?.webUrl ?? null };
  } catch {
    return null;
  }
}

function useOpenDesign(overrideUrl?: string) {
  const [status, setStatus] = useState<StudioStatus>(overrideUrl ? 'running' : 'unknown');
  const [webUrl, setWebUrl] = useState<string | null>(overrideUrl ?? null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (overrideUrl) {
      setStatus('running');
      setWebUrl(overrideUrl);
      return;
    }

    let alive = true;
    const poll = async () => {
      if (!alive) return;
      const snapshot = await fetchStudioStatus();
      if (alive && snapshot) {
        setStatus(snapshot.status);
        setWebUrl(snapshot.webUrl);
      } else if (alive) {
        setStatus('unknown');
      }
      if (alive) setTimeout(poll, POLL_MS);
    };
    void poll();
    return () => {
      alive = false;
    };
  }, [overrideUrl]);

  const start = useCallback(async () => {
    setLoading(true);
    try {
      await fetch('/api/open-design?action=start', { method: 'POST' });
      setStatus('starting');
    } finally {
      setLoading(false);
    }
  }, []);

  const stop = useCallback(async () => {
    setLoading(true);
    try {
      await fetch('/api/open-design?action=stop', { method: 'POST' });
      setStatus('stopped');
      setWebUrl(null);
    } finally {
      setLoading(false);
    }
  }, []);

  return { status, webUrl, loading, start, stop };
}

function DesignStudioToolbar({
  actions,
  projectId,
  studio,
}: {
  actions: DesignActions;
  projectId: string | undefined;
  studio: ReturnType<typeof useOpenDesign>;
}) {
  return (
    <div className="flex items-center justify-between px-1">
      <span className={`text-sm font-medium ${STATUS_COLOR[studio.status]}`}>
        Studio: {studio.status}
      </span>

      <div className="flex items-center gap-2">
        {studio.status === 'running' && projectId && <DesignActionButtons actions={actions} />}
        <StudioControls studio={studio} />
      </div>
    </div>
  );
}

function DesignActionButtons({ actions }: { actions: DesignActions }) {
  return (
    <>
      <Button
        className="h-8 gap-1.5 text-xs"
        disabled={actions.snapshotting}
        onClick={actions.captureSnapshot}
        size="sm"
        variant="outline"
      >
        {actions.snapshotting ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Camera className="h-3.5 w-3.5" />
        )}
        Snapshot
      </Button>
      <Button
        className="h-8 gap-1.5 text-xs"
        disabled={actions.locking}
        onClick={actions.lockDesign}
        size="sm"
        variant="default"
      >
        {actions.locking ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Lock className="h-3.5 w-3.5" />
        )}
        Lock Design
      </Button>
    </>
  );
}

function StudioControls({
  studio,
}: {
  studio: { status: StudioStatus; loading: boolean; start: () => void; stop: () => void };
}) {
  const { status, loading, start, stop } = studio;
  return (
    <div className="flex gap-2">
      {status !== 'running' && (
        <Button
          onClick={start}
          disabled={loading || status === 'starting'}
          size="sm"
          className="h-8 gap-1 text-xs"
        >
          {status === 'starting' ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Play className="h-3 w-3" />
          )}
          {status === 'starting' ? 'Starting…' : 'Start Engine'}
        </Button>
      )}
      {(status === 'running' || status === 'starting') && (
        <Button
          onClick={stop}
          disabled={loading}
          variant="outline"
          size="sm"
          className="text-destructive h-8 gap-1 text-xs"
        >
          <Square className="h-3 w-3" />
          Stop Engine
        </Button>
      )}
    </div>
  );
}

function StudioFrame({
  studio,
  iframeRef,
}: {
  studio: StudioState;
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
}) {
  if (studio.status === 'running' && studio.webUrl) {
    return (
      <iframe
        ref={iframeRef}
        src={studio.webUrl}
        className="min-h-96 w-full flex-1 rounded border border-zinc-800 bg-black"
        title="Open Design Studio"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
      />
    );
  }
  const message =
    studio.status === 'starting'
      ? 'Design Studio is starting up…'
      : studio.status === 'crashed'
        ? 'Studio crashed. Click Start to retry.'
        : 'Click Start Engine to launch the Design Studio.';
  return (
    <div className="text-muted-foreground flex min-h-80 flex-1 flex-col items-center justify-center gap-3 rounded border border-dashed border-zinc-800">
      <Palette className="h-8 w-8" />
      <p className="text-sm">{message}</p>
    </div>
  );
}
