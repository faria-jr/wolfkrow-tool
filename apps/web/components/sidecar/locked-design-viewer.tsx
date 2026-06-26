'use client';

import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Snapshot {
  html: string | null;
  artifactPath: string | null;
}

/**
 * EPIC 4.2e — Read-only preview of a locked design artifact. Fetches the OD
 * project's HTML via the snapshot proxy and renders it in a sandboxed iframe
 * (allow-scripts, no allow-same-origin — the design can run but can't touch the
 * parent origin). Ported (minimal) from LionClaw LockedDesignViewer.
 */
export function LockedDesignViewer({ odProjectId }: { odProjectId: string }) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/open-design/snapshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ odProjectId }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSnapshot((await res.json()) as Snapshot);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load design');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [odProjectId]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm">Locked design</CardTitle>
        <Button size="sm" variant="outline" onClick={load} disabled={loading}>{loading ? 'Loading…' : 'Refresh'}</Button>
      </CardHeader>
      <CardContent>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {!error && snapshot?.html && (
          <iframe
            title="Locked design preview"
            srcDoc={snapshot.html}
            className="h-96 w-full rounded border border-border bg-background"
            sandbox="allow-scripts"
          />
        )}
        {!error && snapshot && !snapshot.html && (
          <p className="text-sm text-muted-foreground">No design artifact found for this project yet.</p>
        )}
      </CardContent>
    </Card>
  );
}
