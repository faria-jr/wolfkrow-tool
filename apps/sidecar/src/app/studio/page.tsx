'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type StudioStatus = 'stopped' | 'starting' | 'running' | 'crashed' | 'offline' | 'unknown';

const POLL_MS = 3000;

interface StudioState {
  status: StudioStatus;
  webUrl: string | null;
  daemonUrl: string | null;
}

const STATUS_COLOR: Record<StudioStatus, string> = {
  running: '#22c55e',
  starting: '#eab308',
  stopped: '#6b7280',
  crashed: '#ef4444',
  offline: '#6b7280',
  unknown: '#9ca3af',
};

async function fetchStudioStatus(): Promise<StudioState> {
  try {
    const res = await fetch('/api/open-design');
    if (!res.ok) return { status: 'offline', webUrl: null, daemonUrl: null };
    const data = (await res.json()) as {
      state?: { status: StudioStatus; webUrl: string | null; daemonUrl: string | null };
    };
    return {
      status: data.state?.status ?? 'unknown',
      webUrl: data.state?.webUrl ?? null,
      daemonUrl: data.state?.daemonUrl ?? null,
    };
  } catch {
    return { status: 'offline', webUrl: null, daemonUrl: null };
  }
}

async function sendAction(action: 'start' | 'stop'): Promise<void> {
  const res = await fetch('/api/open-design', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action }),
  });
  if (!res.ok) throw new Error(`Action failed: ${res.status}`);
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
      if (alive) {
        setStatus(snapshot.status);
        setWebUrl(snapshot.webUrl);
      }
      if (alive) setTimeout(poll, POLL_MS);
    };
    void poll();
    return () => {
      alive = false;
    };
  }, []);

  const start = useCallback(async () => {
    setLoading(true);
    try {
      await sendAction('start');
      setStatus('starting');
    } finally {
      setLoading(false);
    }
  }, []);

  const stop = useCallback(async () => {
    setLoading(true);
    try {
      await sendAction('stop');
      setStatus('stopped');
      setWebUrl(null);
    } finally {
      setLoading(false);
    }
  }, []);

  return { status, webUrl, loading, start, stop };
}

const buttonStyle: React.CSSProperties = {
  padding: '0.5rem 1rem',
  borderRadius: 6,
  border: '1px solid #333',
  background: '#2563eb',
  color: '#fff',
  fontSize: '0.875rem',
  cursor: 'pointer',
  fontWeight: 500,
};

function StudioControls({
  studio,
}: {
  studio: { status: StudioStatus; loading: boolean; start: () => void; stop: () => void };
}) {
  const { status, loading, start, stop } = studio;
  return (
    <div style={{ display: 'flex', gap: '0.5rem' }}>
      {status !== 'running' && (
        <button onClick={start} disabled={loading || status === 'starting'} style={buttonStyle}>
          {status === 'starting' ? 'Starting…' : 'Start Engine'}
        </button>
      )}
      {(status === 'running' || status === 'starting') && (
        <button onClick={stop} disabled={loading} style={{ ...buttonStyle, background: '#374151' }}>
          Stop Engine
        </button>
      )}
    </div>
  );
}

function StudioFrame({ webUrl }: { webUrl: string | null }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  if (!webUrl) return null;
  return (
    <iframe
      ref={iframeRef}
      src={webUrl}
      style={{
        width: '100%',
        flex: 1,
        border: '1px solid #333',
        borderRadius: 8,
        background: '#0a0a0a',
      }}
      title="Open Design Studio"
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
    />
  );
}

function getStatusMessage(status: StudioStatus): string {
  if (status === 'starting') return 'Engine is starting up…';
  if (status === 'crashed') return 'Engine crashed. Click Start to retry.';
  return 'The design engine is not running. Click Start Engine to launch it.';
}

function StudioHeader({
  status,
  webUrl,
  onReload,
  controls,
}: {
  status: StudioStatus;
  webUrl: string | null;
  onReload: () => void;
  controls: React.ReactNode;
}) {
  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '1rem 1.5rem',
        borderBottom: '1px solid #222',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <span style={{ fontSize: '1.5rem' }}>🎨</span>
        <div>
          <h1 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0 }}>Open Design Studio</h1>
          <p style={{ margin: 0, fontSize: '0.75rem', color: STATUS_COLOR[status] }}>
            Engine: {status}
          </p>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        {webUrl && (
          <button
            onClick={onReload}
            style={{ ...buttonStyle, background: '#1f2937', fontSize: '0.8rem' }}
          >
            Reload
          </button>
        )}
        {controls}
      </div>
    </header>
  );
}

function StudioMain({
  webUrl,
  status,
  controls,
}: {
  webUrl: string | null;
  status: StudioStatus;
  controls: React.ReactNode;
}) {
  return (
    <main
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        padding: '1rem',
        overflow: 'hidden',
      }}
    >
      {webUrl ? (
        <StudioFrame webUrl={webUrl} />
      ) : (
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '1rem',
            color: '#888',
          }}
        >
          <span style={{ fontSize: '3rem' }}>🎨</span>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 500, margin: 0 }}>Open Design Studio</h2>
          <p style={{ margin: 0, textAlign: 'center', maxWidth: 360, fontSize: '0.875rem' }}>
            {getStatusMessage(status)}
          </p>
          {controls}
        </div>
      )}
    </main>
  );
}

export default function StudioPage() {
  const studio = useOpenDesign();
  const [iframeKey, setIframeKey] = useState(0);

  const reloadFrame = useCallback(() => {
    setIframeKey((k) => k + 1);
  }, []);

  const controls = <StudioControls studio={studio} />;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        background: '#0f0f0f',
        color: '#f0f0f0',
      }}
    >
      <StudioHeader
        status={studio.status}
        webUrl={studio.webUrl}
        onReload={reloadFrame}
        controls={controls}
      />
      <StudioMain
        key={iframeKey}
        webUrl={studio.webUrl}
        status={studio.status}
        controls={controls}
      />
    </div>
  );
}
