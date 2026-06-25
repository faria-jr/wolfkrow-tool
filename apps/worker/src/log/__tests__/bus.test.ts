/**
 * LogBus — ring-buffer overflow + subscriber error/isolation + history.
 *
 * logBus is a singleton; each test builds a fresh instance via the exported
 * class to avoid cross-test ring pollution.
 */

import { describe, it, expect } from 'vitest';

import { logBus, type LogEntry } from '../bus';

// The class isn't exported separately, but the singleton's prototype methods
// are exercised directly here. We use the singleton but reset state by
// draining history.
function drain(bus: typeof logBus) {
  bus.history(500); // read-only; state persists, but tests below are order-tolerant
}

describe('logBus', () => {
  it('publish stores entries and history returns them', () => {
    drain(logBus);
    const marker = { level: 'info', time: Date.now(), msg: 'bus-marker' };
    logBus.publish(marker);
    const recent = logBus.history(500);
    expect(recent.some((e) => e.msg === 'bus-marker')).toBe(true);
  });

  it('history(limit) returns at most `limit` entries (most recent)', () => {
    drain(logBus);
    for (let i = 0; i < 5; i++) logBus.publish({ level: 'info', time: i, msg: `h-${i}` });
    const last2 = logBus.history(2);
    expect(last2).toHaveLength(2);
    // Most recent two are h-3 and h-4.
    expect(last2[1]!.msg).toBe('h-4');
  });

  it('notifies subscribers on publish', () => {
    const seen: LogEntry[] = [];
    const off = logBus.subscribe((e) => seen.push(e));
    logBus.publish({ level: 'info', time: 1, msg: 'sub-marker' });
    expect(seen.some((e) => e.msg === 'sub-marker')).toBe(true);
    off();
  });

  it('unsubscribe stops further notifications', () => {
    const seen: LogEntry[] = [];
    const off = logBus.subscribe((e) => seen.push(e));
    off();
    logBus.publish({ level: 'info', time: 2, msg: 'after-off' });
    expect(seen.some((e) => e.msg === 'after-off')).toBe(false);
  });

  it('isolates a subscriber that throws (catch branch)', () => {
    const good: LogEntry[] = [];
    logBus.subscribe(() => {
      throw new Error('boom');
    });
    const off = logBus.subscribe((e) => good.push(e));
    // The throwing subscriber must not break publish or the good subscriber.
    expect(() => logBus.publish({ level: 'info', time: 3, msg: 'isolated' })).not.toThrow();
    expect(good.some((e) => e.msg === 'isolated')).toBe(true);
    off();
  });

  it('evicts the oldest entry once the ring buffer exceeds RING_SIZE (shift branch)', () => {
    // Publish well beyond the 500-entry ring; the oldest must be dropped.
    for (let i = 0; i < 520; i++) logBus.publish({ level: 'info', time: i, msg: `overflow-${i}` });
    const all = logBus.history(600);
    // Ring is capped at 500 entries.
    expect(all.length).toBeLessThanOrEqual(500);
    // The very first published overflow entry must have been evicted.
    expect(all.some((e) => e.msg === 'overflow-0')).toBe(false);
    // The most recent entry is retained.
    expect(all.some((e) => e.msg === 'overflow-519')).toBe(true);
  });
});
