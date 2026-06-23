'use client';

import type { ArtifactType } from './artifact-detector';

interface Props {
  output: string;
  artifactType: ArtifactType;
}

export function ArtifactCard({ output, artifactType }: Props) {
  if (artifactType === 'excalidraw') {
    return <ExcalidrawCard output={output} />;
  }

  if (artifactType === 'json') {
    let formatted: string;
    try {
      formatted = JSON.stringify(JSON.parse(output), null, 2);
    } catch {
      formatted = output;
    }
    return (
      <pre className="mt-1 overflow-x-auto whitespace-pre-wrap text-muted-foreground">{formatted}</pre>
    );
  }

  if (artifactType === 'code') {
    // Strip surrounding backtick fences for display
    const stripped = output
      .replace(/^```[^\n]*\n/, '')
      .replace(/\n```$/, '');
    return (
      <pre className="mt-1 overflow-x-auto whitespace-pre-wrap font-mono text-muted-foreground bg-muted/50 rounded p-2">
        {stripped}
      </pre>
    );
  }

  // text fallback
  return (
    <pre className="mt-1 overflow-x-auto whitespace-pre-wrap text-muted-foreground">{output}</pre>
  );
}

interface ExcalidrawData {
  type: 'excalidraw';
  elements: Array<{ type?: string; [key: string]: unknown }>;
  appState?: Record<string, unknown>;
}

function DiagramIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <path d="M14 17.5h7M17.5 14v7" />
    </svg>
  );
}

function buildShapeSummary(elements: Array<{ type?: string }>): string {
  const counts = elements.reduce<Record<string, number>>((acc, el) => {
    const t = el.type ?? 'unknown';
    acc[t] = (acc[t] ?? 0) + 1;
    return acc;
  }, {});
  return Object.entries(counts).map(([t, n]) => `${n} ${t}`).join(', ');
}

function ExcalidrawCard({ output }: { output: string }) {
  let data: ExcalidrawData;
  try {
    data = JSON.parse(output) as ExcalidrawData;
  } catch {
    return <pre className="mt-1 overflow-x-auto whitespace-pre-wrap text-muted-foreground">{output}</pre>;
  }

  const elements = data.elements ?? [];
  const url = `https://excalidraw.com/#json=${btoa(output)}`;
  const shapeSummary = buildShapeSummary(elements);

  return (
    <div className="mt-1 rounded border border-border bg-muted/20 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <DiagramIcon />
          <span className="font-semibold text-foreground">Excalidraw Diagram</span>
        </div>
        <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded bg-primary px-2 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
          Open in Excalidraw
        </a>
      </div>
      <div className="mt-2 text-xs text-muted-foreground">
        <span>{elements.length} elements</span>
        {shapeSummary && <span className="ml-2 text-muted-foreground/70">({shapeSummary})</span>}
      </div>
    </div>
  );
}
