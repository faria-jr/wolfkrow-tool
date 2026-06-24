'use client';

import { useEffect, useState } from 'react';

interface PipelineReport {
  report: string;
}

interface FetchState {
  loading: boolean;
  error: string | null;
  report: string | null;
}

export function PipelineReportView({ projectId }: { projectId: string }) {
  const [state, setState] = useState<FetchState>({ loading: true, error: null, report: null });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/pipeline/projects/${encodeURIComponent(projectId)}/report`, {
          credentials: 'include',
        });
        if (cancelled) return;
        if (!res.ok) {
          setState({ loading: false, error: `Failed: ${res.status}`, report: null });
          return;
        }
        const data = (await res.json()) as PipelineReport;
        setState({ loading: false, error: null, report: data.report });
      } catch (err) {
        if (cancelled) return;
        setState({ loading: false, error: (err as Error).message, report: null });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  if (state.loading) {
    return (
      <div className="py-12 text-center text-muted-foreground">Generating report…</div>
    );
  }

  if (state.error || !state.report) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
        {state.error ?? 'No report available.'}
      </div>
    );
  }

  return (
    <article className="prose prose-sm dark:prose-invert max-w-none">
      <pre className="overflow-x-auto rounded-md border bg-muted/40 p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap">
        {state.report}
      </pre>
    </article>
  );
}
