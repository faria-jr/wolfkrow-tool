'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type SidecarStatus = 'stopped' | 'starting' | 'running' | 'crashed' | 'unknown';

const SIDECAR_URL = process.env['NEXT_PUBLIC_SIDECAR_URL'] ?? 'http://localhost:5000';
const POLL_MS = 3000;

const STATUS_COLOR: Record<SidecarStatus, string> = {
  running: 'text-green-500',
  starting: 'text-yellow-500',
  stopped: 'text-gray-500',
  crashed: 'text-red-500',
  unknown: 'text-gray-400',
};

export function DesignStudio() {
  const sidecar = useSidecar();
  const iframeRef = useRef<HTMLIFrameElement>(null);

  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="flex items-center justify-between px-1">
        <span className={`text-sm font-medium ${STATUS_COLOR[sidecar.status]}`}>
          Studio: {sidecar.status}
        </span>
        <StudioControls sidecar={sidecar} />
      </div>
      <StudioFrame status={sidecar.status} iframeRef={iframeRef} />
    </div>
  );
}

function useSidecar() {
  const [status, setStatus] = useState<SidecarStatus>('unknown');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    const poll = async () => {
      if (!alive) return;
      try {
        const res = await fetch('/api/sidecar');
        if (res.ok) {
          const data = (await res.json()) as { state?: { status: SidecarStatus } };
          if (alive) setStatus(data.state?.status ?? 'unknown');
        }
      } catch {
        if (alive) setStatus('unknown');
      }
      if (alive) setTimeout(poll, POLL_MS);
    };
    void poll();
    return () => { alive = false; };
  }, []);

  const start = useCallback(async () => {
    setLoading(true);
    try {
      await fetch('/api/sidecar?action=start', { method: 'POST' });
      setStatus('starting');
    } finally {
      setLoading(false);
    }
  }, []);

  const stop = useCallback(async () => {
    setLoading(true);
    try {
      await fetch('/api/sidecar?action=stop', { method: 'POST' });
      setStatus('stopped');
    } finally {
      setLoading(false);
    }
  }, []);

  return { status, loading, start, stop };
}

function StudioControls({ sidecar }: { sidecar: { status: SidecarStatus; loading: boolean; start: () => void; stop: () => void } }) {
  const { status, loading, start, stop } = sidecar;
  return (
    <div className="flex gap-2">
      {status !== 'running' && (
        <button
          onClick={start}
          disabled={loading || status === 'starting'}
          className="px-3 py-1 text-xs rounded bg-primary text-primary-foreground disabled:opacity-50"
        >
          {status === 'starting' ? 'Starting…' : 'Start'}
        </button>
      )}
      {(status === 'running' || status === 'starting') && (
        <button
          onClick={stop}
          disabled={loading}
          className="px-3 py-1 text-xs rounded border border-destructive text-destructive disabled:opacity-50"
        >
          Stop
        </button>
      )}
    </div>
  );
}

function StudioFrame({ status, iframeRef }: { status: SidecarStatus; iframeRef: React.RefObject<HTMLIFrameElement | null> }) {
  if (status === 'running') {
    return (
      <iframe
        ref={iframeRef}
        src={SIDECAR_URL}
        className="flex-1 w-full rounded border border-border bg-background"
        title="Open Design Studio"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
      />
    );
  }
  const message = status === 'starting'
    ? 'Design Studio is starting up…'
    : status === 'crashed'
      ? 'Studio crashed. Click Start to retry.'
      : 'Click Start to launch the Design Studio.';
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 rounded border border-dashed border-border text-muted-foreground">
      <span className="text-3xl">🎨</span>
      <p className="text-sm">{message}</p>
    </div>
  );
}
