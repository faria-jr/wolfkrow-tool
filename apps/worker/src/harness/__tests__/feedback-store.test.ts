import { afterEach, describe, expect, it } from 'vitest';

import { clearFeedback, drainFeedback, recordFeedback } from '../feedback-store';

afterEach(() => {
  clearFeedback();
});

describe('feedback-store', () => {
  it('records and drains feedback for a feature', () => {
    recordFeedback('p1', 0, 'focus on error handling');
    expect(drainFeedback('p1', 0)).toBe('focus on error handling');
  });

  it('drain clears the feedback (one-shot)', () => {
    recordFeedback('p1', 0, 'first');
    expect(drainFeedback('p1', 0)).toBe('first');
    expect(drainFeedback('p1', 0)).toBe('');
  });

  it('accumulates multiple feedback lines for the same feature', () => {
    recordFeedback('p1', 1, 'line one');
    recordFeedback('p1', 1, 'line two');
    expect(drainFeedback('p1', 1)).toBe('line one\nline two');
  });

  it('isolates feedback by project + feature', () => {
    recordFeedback('p1', 0, 'a');
    recordFeedback('p1', 1, 'b');
    recordFeedback('p2', 0, 'c');
    expect(drainFeedback('p1', 0)).toBe('a');
    expect(drainFeedback('p1', 1)).toBe('b');
    expect(drainFeedback('p2', 0)).toBe('c');
  });

  it('returns empty string when no feedback exists', () => {
    expect(drainFeedback('p1', 5)).toBe('');
  });

  it('clearFeedback removes everything', () => {
    recordFeedback('p1', 0, 'x');
    clearFeedback();
    expect(drainFeedback('p1', 0)).toBe('');
  });
});
