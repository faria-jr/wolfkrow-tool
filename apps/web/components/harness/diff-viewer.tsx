'use client';

import { useMemo } from 'react';

import { computeLineDiff, summarizeDiff, type DiffLine } from './diff';

interface DiffViewerProps {
 before: string;
 after: string;
 /** Optional label shown in the header strip. */
 title?: string;
 /** Cap rendered lines (defaults to 1000 to keep the DOM responsive). */
 maxLines?: number;
}

const PREFIX: Record<DiffLine['type'], string> = {
 equal: ' ',
 add: '+',
 remove: '-',
};

/**
 * - Renders a unified line diff between two strings. Used to surface
 * per-round coder output deltas in the Harness UI ("what changed between
 * round 3 and round 4?"). Pairs well with the harness runner which
 * already retains prior round outputs.
 */
export function DiffViewer({ before, after, title, maxLines = 1000 }: DiffViewerProps) {
 const ops = useMemo(() => computeLineDiff(before, after), [before, after]);
 const summary = useMemo(() => summarizeDiff(ops), [ops]);
 const truncated = ops.length > maxLines;
 const visible = truncated ? ops.slice(0, maxLines) : ops;

 return (
 <div className="overflow-hidden rounded-md border bg-muted/40 font-mono text-xs">
 <div className="flex items-center justify-between border-b bg-muted px-3 py-1.5 text-xs uppercase tracking-wide text-muted-foreground">
 <span>{title ?? 'Diff'}</span>
 <span className="flex items-center gap-3">
 <span className="text-success">+{summary.added}</span>
 <span className="text-destructive">-{summary.removed}</span>
 <span className="text-muted-foreground">={summary.unchanged}</span>
 </span>
 </div>
 <div className="overflow-x-auto" data-testid="diff-viewer-body">
 <table className="w-full border-collapse">
 <tbody>
 {visible.map((op, idx) => (
 <tr key={idx} className={rowClass(op.type)}>
 <td className="select-none border-r px-2 py-0.5 text-right text-xs text-muted-foreground w-10">
 {op.oldLine ?? ''}
 </td>
 <td className="select-none border-r px-2 py-0.5 text-right text-xs text-muted-foreground w-10">
 {op.newLine ?? ''}
 </td>
 <td className="select-none px-2 py-0.5 text-xs text-muted-foreground w-3">
 {PREFIX[op.type]}
 </td>
 <td className="whitespace-pre px-2 py-0.5">
 {op.text || '\u00A0'}
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 {truncated && (
 <div className="border-t bg-muted px-3 py-1 text-xs text-muted-foreground">
 Truncated at {maxLines} of {ops.length} lines. Use the API for the full diff.
 </div>
 )}
 </div>
 </div>
 );
}

function rowClass(type: DiffLine['type']): string {
 if (type === 'add') return 'bg-success/10';
 if (type === 'remove') return 'bg-destructive/10';
 return '';
}
