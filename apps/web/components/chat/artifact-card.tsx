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
      <pre className="text-muted-foreground mt-1 overflow-x-auto whitespace-pre-wrap">
        {formatted}
      </pre>
    );
  }

  if (artifactType === 'code') {
    // Strip surrounding backtick fences for display
    const stripped = output.replace(/^```[^\n]*\n/, '').replace(/\n```$/, '');
    return (
      <pre className="text-muted-foreground bg-muted/50 mt-1 overflow-x-auto whitespace-pre-wrap rounded p-2 font-mono">
        {stripped}
      </pre>
    );
  }

  // text fallback
  return (
    <pre className="text-muted-foreground mt-1 overflow-x-auto whitespace-pre-wrap">{output}</pre>
  );
}

interface ExcalidrawData {
  type: 'excalidraw';
  elements: Array<{ type?: string; [key: string]: unknown }>;
  appState?: Record<string, unknown>;
}

function DiagramIcon() {
  return (
    <svg
      aria-hidden="true"
      className="text-muted-foreground h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
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
  return Object.entries(counts)
    .map(([t, n]) => `${n} ${t}`)
    .join(', ');
}

function ExcalidrawCard({ output }: { output: string }) {
  let data: ExcalidrawData;
  try {
    data = JSON.parse(output) as ExcalidrawData;
  } catch {
    return (
      <pre className="text-muted-foreground mt-1 overflow-x-auto whitespace-pre-wrap">{output}</pre>
    );
  }

  const elements = data.elements ?? [];
  const url = `https://excalidraw.com/#json=${btoa(output)}`;
  const shapeSummary = buildShapeSummary(elements);

  return (
    <div className="border-border bg-muted/20 mt-1 rounded border p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <DiagramIcon />
          <span className="text-foreground font-semibold">Excalidraw Diagram</span>
        </div>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors"
        >
          Open in Excalidraw
        </a>
      </div>
      <div className="text-muted-foreground mt-2 text-xs">
        <span>{elements.length} elements</span>
        {shapeSummary && <span className="text-muted-foreground/70 ml-2">({shapeSummary})</span>}
      </div>
    </div>
  );
}
