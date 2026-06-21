'use client';

import { useEffect, useRef, useState } from 'react';

type SidecarStatus = 'stopped' | 'starting' | 'running' | 'crashed' | 'unknown';

const SIDECAR_URL = process.env['NEXT_PUBLIC_SIDECAR_URL'] ?? 'http://localhost:5000';
const POLL_MS = 3000;

export function DesignStudio() {
  const [status, setStatus] = useState<SidecarStatus>('unknown');
  const [loading, setLoading] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

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

  const start = async () => {
    setLoading(true);
    try {
      await fetch('/api/sidecar?action=start', { method: 'POST' });
      setStatus('starting');
    } finally {
      setLoading(false);
    }
  };

  const stop = async () => {
    setLoading(true);
    try {
      await fetch('/api/sidecar?action=stop', { method: 'POST' });
      setStatus('stopped');
    } finally {
      setLoading(false);
    }
  };

  const statusColor: Record<SidecarStatus, string> = {
    running: 'text-green-500',
    starting: 'text-yellow-500',
    stopped: 'text-gray-500',
    crashed: 'text-red-500',
    unknown: 'text-gray-400',
  };

  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="flex items-center justify-between px-1">
        <span className={`text-sm font-medium ${statusColor[status]}`}>
          Studio: {status}
        </span>
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
      </div>

      {status === 'running' ? (
        <iframe
          ref={iframeRef}
          src={SIDECAR_URL}
          className="flex-1 w-full rounded border border-border bg-background"
          title="Open Design Studio"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        />
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 rounded border border-dashed border-border text-muted-foreground">
          <span className="text-3xl">🎨</span>
          <p className="text-sm">
            {status === 'starting'
              ? 'Design Studio is starting up…'
              : status === 'crashed'
              ? 'Studio crashed. Click Start to retry.'
              : 'Click Start to launch the Design Studio.'}
          </p>
        </div>
      )}
    </div>
  );
}
