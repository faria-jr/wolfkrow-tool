'use client';

import { ArtifactCard } from './artifact-card';
import { detectArtifact } from './artifact-detector';

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
  output?: string;
  status: 'pending' | 'running' | 'done' | 'error';
}

interface Props {
  toolCall: ToolCall;
}

export function ToolCallInline({ toolCall }: Props) {
  const artifactType = toolCall.output ? detectArtifact(toolCall.output) : undefined;

  return (
    <div
      className="border-border bg-muted/30 my-1 rounded border px-3 py-2 font-mono text-xs"
      role="article"
      aria-label={`Tool call: ${toolCall.name}`}
    >
      <div className="flex items-center gap-2">
        <span className="text-foreground font-semibold">{toolCall.name}</span>
        <StatusBadge status={toolCall.status} />
      </div>
      {toolCall.output && artifactType && (
        <ArtifactCard output={toolCall.output} artifactType={artifactType} />
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: ToolCall['status'] }) {
  const map = { pending: '⏳', running: '⚙️', done: '✓', error: '✗' } as const;
  return <span aria-label={status}>{map[status]}</span>;
}
