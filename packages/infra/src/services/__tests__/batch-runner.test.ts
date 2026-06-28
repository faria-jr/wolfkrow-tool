import { describe, expect, it } from 'vitest';

import { runInBatches } from '../batch-runner';

describe('runInBatches', () => {
  it('processes all items and returns results in order', async () => {
    const items = [1, 2, 3, 4, 5];
    const worker = async (n: number) => n * 2;
    const results = await runInBatches(items, worker, 2);
    expect(results).toEqual([2, 4, 6, 8, 10]);
  });

  it('returns empty array for empty items', async () => {
    const results = await runInBatches<number, number>([], async (n) => n, 3);
    expect(results).toEqual([]);
  });

  it('respects concurrency limit', async () => {
    const items = Array.from({ length: 10 }, (_, i) => i);
    let active = 0;
    let maxActive = 0;
    const worker = async (n: number) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((r) => setTimeout(r, 5));
      active -= 1;
      return n;
    };
    await runInBatches(items, worker, 3);
    expect(maxActive).toBeLessThanOrEqual(3);
  });

  it('handles single concurrency', async () => {
    const items = [10, 20, 30];
    const results = await runInBatches(items, async (n) => n + 1, 1);
    expect(results).toEqual([11, 21, 31]);
  });

  it('propagates errors from worker', async () => {
    const items = [1, 2, 3];
    const worker = async (n: number) => {
      if (n === 2) throw new Error('boom');
      return n;
    };
    await expect(runInBatches(items, worker, 2)).rejects.toThrow('boom');
  });
});
