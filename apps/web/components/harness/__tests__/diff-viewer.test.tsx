import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { computeLineDiff, summarizeDiff } from '../diff';
import { DiffViewer } from '../diff-viewer';

describe('computeLineDiff (M5.3)', () => {
  it('returns all-equal for identical inputs', () => {
    const ops = computeLineDiff('a\nb\nc', 'a\nb\nc');
    expect(ops.every((o) => o.type === 'equal')).toBe(true);
    expect(ops.length).toBe(3);
    expect(ops[0]?.oldLine).toBe(1);
    expect(ops[0]?.newLine).toBe(1);
  });

  it('flags pure additions', () => {
    const ops = computeLineDiff('', 'hello\nworld');
    expect(ops).toHaveLength(2);
    expect(ops[0]).toMatchObject({ type: 'add', text: 'hello', oldLine: undefined, newLine: 1 });
    expect(ops[1]).toMatchObject({ type: 'add', text: 'world', newLine: 2 });
  });

  it('flags pure removals', () => {
    const ops = computeLineDiff('a\nb\nc', '');
    expect(ops).toHaveLength(3);
    expect(ops.every((o) => o.type === 'remove')).toBe(true);
    expect(ops[0]).toMatchObject({ oldLine: 1, newLine: undefined });
  });

  it('mixes add/remove/equal correctly', () => {
    const ops = computeLineDiff('a\nb\nc', 'a\nB\nc\nd');
    const summary = summarizeDiff(ops);
    expect(summary.added).toBe(2); // B + d
    expect(summary.removed).toBe(1); // b
    expect(summary.unchanged).toBe(2); // a + c
    const types = ops.map((o) => o.type);
    expect(types).toContain('equal');
    expect(types).toContain('add');
    expect(types).toContain('remove');
  });

  it('handles empty inputs gracefully', () => {
    expect(computeLineDiff('', '')).toEqual([]);
  });

  it('handles large inputs without blowing up', () => {
    const before = Array.from({ length: 500 }, (_, i) => `line-${i}`).join('\n');
    const after = Array.from({ length: 500 }, (_, i) => (i % 2 === 0 ? `line-${i}` : `changed-${i}`)).join('\n');
    const ops = computeLineDiff(before, after);
    const summary = summarizeDiff(ops);
    expect(summary.unchanged).toBe(250);
    expect(summary.removed).toBe(250);
    expect(summary.added).toBe(250);
  });
});

describe('DiffViewer (M5.3)', () => {
  it('renders the summary header with add/remove/equal counts', () => {
    render(<DiffViewer before={'a'} after={'a\nb'} title="Round 1→2" />);
    expect(screen.getByText('Round 1→2')).toBeInTheDocument();
    expect(screen.getByText(/\+1/)).toBeInTheDocument();
    expect(screen.getByText(/=1/)).toBeInTheDocument();
  });

  it('renders the prefix character per row type', () => {
    const { container } = render(
      <DiffViewer before={'keep\ndrop'} after={'keep\nadd'} />,
    );
    const cells = container.querySelectorAll('tbody tr');
    expect(cells).toHaveLength(3);
    expect(cells[0]?.textContent).toMatch(/keep/);
    expect(cells[1]?.textContent).toMatch(/add/);
    expect(cells[2]?.textContent).toMatch(/drop/);
  });

  it('truncates long diffs with a notice', () => {
    const lines = Array.from({ length: 50 }, (_, i) => `line-${i}`).join('\n');
    const { container } = render(<DiffViewer before={lines} after={lines} maxLines={5} />);
    expect(container.querySelectorAll('tbody tr')).toHaveLength(5);
    expect(screen.getByText(/Truncated at 5 of/)).toBeInTheDocument();
  });
});
