'use client';

import type { ComponentPropsWithoutRef } from 'react';
import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const markdownComponents = {
  pre: ({ children }: ComponentPropsWithoutRef<'pre'>) => (
    <pre className="bg-muted/40 overflow-x-auto rounded-md border p-3 font-mono text-xs">
      {children}
    </pre>
  ),
};

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
    return <div className="text-muted-foreground py-12 text-center">Generating report…</div>;
  }

  if (state.error || !state.report) {
    return (
      <div className="border-destructive/30 bg-destructive/10 text-destructive rounded-md border px-4 py-3 text-sm">
        {state.error ?? 'No report available.'}
      </div>
    );
  }

  return (
    <article className="prose prose-sm dark:prose-invert max-w-none">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {state.report}
      </ReactMarkdown>
    </article>
  );
}
