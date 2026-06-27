'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Camera, Lock, Play, Square, Loader2 } from 'lucide-react';

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
  const [snapshotting, setSnapshotting] = useState(false);
  const [locking, setLocking] = useState(false);

  const handleCaptureSnapshot = async () => {
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

  const handleLockDesign = async () => {
    if (!projectId) return;
    setLocking(true);
    try {
      const res = await fetch('/api/open-design/lock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ odProjectId: projectId, outputDir: './apps/web/components/design-export' }),
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

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-center justify-between px-1">
        <span className={`text-sm font-medium ${STATUS_COLOR[studio.status]}`}>
          Studio: {studio.status}
        </span>
        
        <div className="flex items-center gap-2">
          {studio.status === 'running' && projectId && (
            <>
              <Button
                onClick={handleCaptureSnapshot}
                disabled={snapshotting}
                size="sm"
                variant="outline"
                className="gap-1.5 text-xs h-8"
              >
                {snapshotting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
                Snapshot
              </Button>
              <Button
                onClick={handleLockDesign}
                disabled={locking}
                size="sm"
                variant="default"
                className="gap-1.5 text-xs h-8"
              >
                {locking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Lock className="h-3.5 w-3.5" />}
                Lock Design
              </Button>
            </>
          )}
          <StudioControls studio={studio} />
        </div>
      </div>
      <StudioFrame studio={studio} iframeRef={iframeRef} />
    </div>
  );
}

async function fetchStudioStatus(): Promise<{ status: StudioStatus; webUrl: string | null } | null> {
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
    return () => { alive = false; };
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

function StudioControls({ studio }: { studio: { status: StudioStatus; loading: boolean; start: () => void; stop: () => void } }) {
  const { status, loading, start, stop } = studio;
  return (
    <div className="flex gap-2">
      {status !== 'running' && (
        <Button onClick={start} disabled={loading || status === 'starting'} size="sm" className="h-8 gap-1 text-xs">
          {status === 'starting' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
          {status === 'starting' ? 'Starting…' : 'Start Engine'}
        </Button>
      )}
      {(status === 'running' || status === 'starting') && (
        <Button onClick={stop} disabled={loading} variant="outline" size="sm" className="h-8 gap-1 text-xs text-destructive">
          <Square className="h-3 w-3" />
          Stop Engine
        </Button>
      )}
    </div>
  );
}

function StudioFrame({ studio, iframeRef }: { studio: StudioState; iframeRef: React.RefObject<HTMLIFrameElement | null> }) {
  if (studio.status === 'running' && studio.webUrl) {
    return (
      <iframe
        ref={iframeRef}
        src={studio.webUrl}
        className="w-full flex-1 rounded border border-zinc-800 bg-black min-h-[400px]"
        title="Open Design Studio"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
      />
    );
  }
  const message = studio.status === 'starting'
    ? 'Design Studio is starting up…'
    : studio.status === 'crashed'
      ? 'Studio crashed. Click Start to retry.'
      : 'Click Start Engine to launch the Design Studio.';
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded border border-dashed border-zinc-800 text-muted-foreground min-h-[300px]">
      <span className="text-3xl animate-bounce">🎨</span>
      <p className="text-sm">{message}</p>
    </div>
  );
}
