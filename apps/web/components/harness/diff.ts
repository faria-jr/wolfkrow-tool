/**
 * - Hand-rolled line diff viewer.
 *
 * Pure-function `computeLineDiff(before, after)` returns a sequence of
 * `{ type: 'equal' | 'add' | 'remove', text, oldLine?, newLine? }` entries
 * using the classic Longest-Common-Subsequence DP. O(before.length *
 * after.length) time and memory - fine for the round sizes we deal with
 * (a few thousand lines per round tops).
 *
 * No external `diff` library - keeps the bundle small and avoids the
 * BSD-3 licensing / maintenance dance.
 */

export type DiffOpType = 'equal' | 'add' | 'remove';

export interface DiffLine {
  type: DiffOpType;
  text: string;
  /** 1-based line number in `before`. Undefined for `add` lines. */
  oldLine: number | undefined;
  /** 1-based line number in `after`. Undefined for `remove` lines. */
  newLine: number | undefined;
}

export function computeLineDiff(before: string, after: string): DiffLine[] {
  const a = splitLines(before);
  const b = splitLines(after);
  const dpRow = computeLcsRow(a, b);
  return walkLcs(a, b, dpRow);
}

/**
 * Build the bottom-up LCS length table. Returns the row for i=0 (LCS of
 * the full inputs), which is what the walk needs to make forward choices.
 * Splits the table-build out of `computeLineDiff` to keep the function
 * under the linter's complexity cap.
 */
function computeLcsRow(a: string[], b: string[]): number[] {
  const n = b.length;
  let prev: number[] = new Array(n + 1).fill(0);
  let curr: number[] = new Array(n + 1).fill(0);
  for (let i = a.length - 1; i >= 0; i--) {
    const aLine = a[i] ?? '';
    for (let j = n - 1; j >= 0; j--) {
      curr[j] =
        aLine === (b[j] ?? '') ? (prev[j + 1] ?? 0) + 1 : Math.max(prev[j] ?? 0, curr[j + 1] ?? 0);
    }
    [prev, curr] = [curr, prev];
    curr.fill(0);
  }
  return prev;
}

interface WalkContext {
  a: string[];
  b: string[];
  lcs: number[];
  cursor: { i: number; j: number };
  ops: DiffLine[];
}

/**
 * Walk the LCS table from (0, 0) forward, emitting `equal` / `add` /
 * `remove` ops. Tie-breaks toward `add` so common future matches in
 * `after` are kept as `equal` rather than being removed-then-re-added.
 */
function walkLcs(a: string[], b: string[], lcs: number[]): DiffLine[] {
  const ctx: WalkContext = { a, b, lcs, cursor: { i: 0, j: 0 }, ops: [] };
  while (ctx.cursor.i < a.length && ctx.cursor.j < b.length) {
    stepWalkLcs(ctx);
  }
  appendTail(ctx);
  return ctx.ops;
}

function stepWalkLcs(ctx: WalkContext): void {
  const aLine = ctx.a[ctx.cursor.i] ?? '';
  const bLine = ctx.b[ctx.cursor.j] ?? '';
  if (aLine === bLine) {
    ctx.ops.push({
      type: 'equal',
      text: aLine,
      oldLine: ctx.cursor.i + 1,
      newLine: ctx.cursor.j + 1,
    });
    ctx.cursor.i++;
    ctx.cursor.j++;
  } else if ((ctx.lcs[ctx.cursor.j] ?? 0) > (ctx.lcs[ctx.cursor.j + 1] ?? 0)) {
    ctx.ops.push({ type: 'remove', text: aLine, oldLine: ctx.cursor.i + 1, newLine: undefined });
    ctx.cursor.i++;
  } else {
    ctx.ops.push({ type: 'add', text: bLine, oldLine: undefined, newLine: ctx.cursor.j + 1 });
    ctx.cursor.j++;
  }
}

function appendTail(ctx: WalkContext): void {
  while (ctx.cursor.i < ctx.a.length) {
    ctx.ops.push({
      type: 'remove',
      text: ctx.a[ctx.cursor.i] ?? '',
      oldLine: ctx.cursor.i + 1,
      newLine: undefined,
    });
    ctx.cursor.i++;
  }
  while (ctx.cursor.j < ctx.b.length) {
    ctx.ops.push({
      type: 'add',
      text: ctx.b[ctx.cursor.j] ?? '',
      oldLine: undefined,
      newLine: ctx.cursor.j + 1,
    });
    ctx.cursor.j++;
  }
}

function splitLines(text: string): string[] {
  if (text.length === 0) return [];
  // Split on \n but keep empty strings (so an empty file is [] not ['']).
  return text.split('\n');
}

/** Summary stats over a diff - used for the header strip. */
export interface DiffSummary {
  added: number;
  removed: number;
  unchanged: number;
}

export function summarizeDiff(ops: ReadonlyArray<DiffLine>): DiffSummary {
  let added = 0;
  let removed = 0;
  let unchanged = 0;
  for (const op of ops) {
    if (op.type === 'add') added++;
    else if (op.type === 'remove') removed++;
    else unchanged++;
  }
  return { added, removed, unchanged };
}
