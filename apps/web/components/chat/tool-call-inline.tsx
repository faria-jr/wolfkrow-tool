'use client';

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
  return (
    <div className="my-1 rounded border border-border bg-muted/30 px-3 py-2 text-xs font-mono" role="article" aria-label={`Tool call: ${toolCall.name}`}>
      <div className="flex items-center gap-2">
        <span className="font-semibold text-foreground">{toolCall.name}</span>
        <StatusBadge status={toolCall.status} />
      </div>
      {toolCall.output && (
        <pre className="mt-1 overflow-x-auto whitespace-pre-wrap text-muted-foreground">{toolCall.output}</pre>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: ToolCall['status'] }) {
  const map = { pending: '⏳', running: '⚙️', done: '✓', error: '✗' } as const;
  return <span aria-label={status}>{map[status]}</span>;
}
