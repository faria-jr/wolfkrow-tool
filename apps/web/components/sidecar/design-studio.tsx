'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

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

export function DesignStudio() {
  const studio = useOpenDesign();
  const iframeRef = useRef<HTMLIFrameElement>(null);

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-center justify-between px-1">
        <span className={`text-sm font-medium ${STATUS_COLOR[studio.status]}`}>
          Studio: {studio.status}
        </span>
        <StudioControls studio={studio} />
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

function useOpenDesign() {
  const [status, setStatus] = useState<StudioStatus>('unknown');
  const [webUrl, setWebUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
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
  }, []);

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
        <Button onClick={start} disabled={loading || status === 'starting'} size="sm">
          {status === 'starting' ? 'Starting…' : 'Start'}
        </Button>
      )}
      {(status === 'running' || status === 'starting') && (
        <Button onClick={stop} disabled={loading} variant="outline" size="sm" className="text-destructive">
          Stop
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
        className="w-full flex-1 rounded border border-border bg-background"
        title="Open Design Studio"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
      />
    );
  }
  const message = studio.status === 'starting'
    ? 'Design Studio is starting up…'
    : studio.status === 'crashed'
      ? 'Studio crashed. Click Start to retry.'
      : 'Click Start to launch the Design Studio.';
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded border border-dashed border-border text-muted-foreground">
      <span className="text-3xl">🎨</span>
      <p className="text-sm">{message}</p>
    </div>
  );
}
