'use client';

import { Activity } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import { StatusBadge } from '@/lib/status-badge';

/**
 * DEBT #13 (EPIC 2.1) — Global active-runs strip.
 *
 * Polls harness + pipeline projects (lightweight, 10s) and surfaces the ones
 * still running so the user never loses track of in-flight jobs while browsing
 * other routes. Click-through jumps to the relevant monitor. Hidden when there
 * are no active runs (matches LionClaw PipelinesActiveSidebar intent).
 */

const POLL_MS = 10_000;
const ACTIVE = new Set(['running', 'in_progress', 'planning', 'active']);

interface ActiveRun {
  id: string;
  name: string;
  status: string;
  href: string;
}

function isActive(s: string): boolean {
  return ACTIVE.has(s.toLowerCase());
}

async function fetchActiveRuns(): Promise<ActiveRun[]> {
  const [hRes, pRes] = await Promise.all([
    fetch('/api/harness/projects').catch(() => null),
    fetch('/api/pipeline/projects').catch(() => null),
  ]);
  const runs: ActiveRun[] = [];
  if (hRes?.ok) {
    for (const p of (await hRes.json()) as Array<{ id: string; name: string; status: string }>) {
      if (isActive(p.status)) runs.push({ id: p.id, name: p.name, status: p.status, href: '/harness' });
    }
  }
  if (pRes?.ok) {
    for (const p of (await pRes.json()) as Array<{ id: string; name: string; status: string }>) {
      if (isActive(p.status)) runs.push({ id: p.id, name: p.name, status: p.status, href: '/pipeline' });
    }
  }
  return runs;
}

export function ActiveRunsBar() {
  const [runs, setRuns] = useState<ActiveRun[]>([]);

  const load = useCallback(async () => {
    try {
      setRuns(await fetchActiveRuns());
    } catch {
      setRuns([]);
    }
  }, []);

  useEffect(() => {
    void load();
    const id = setInterval(() => { void load(); }, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  if (runs.length === 0) return null;

  return (
    <div className="flex items-center gap-3 border-t bg-muted/40 px-4 py-1.5 text-xs">
      <span className="flex shrink-0 items-center gap-1 font-medium text-muted-foreground">
        <Activity className="h-3.5 w-3.5" /> Active ({runs.length})
      </span>
      <div className="flex flex-1 items-center gap-2 overflow-x-auto">
        {runs.map((run) => (
          <Link
            key={run.id}
            href={run.href}
            className="flex shrink-0 items-center gap-1.5 rounded border bg-card px-2 py-0.5 hover:bg-muted"
          >
            <span className="max-w-32 truncate">{run.name}</span>
            <StatusBadge status={run.status} className="px-1.5 py-0 text-xs" />
          </Link>
        ))}
      </div>
    </div>
  );
}
