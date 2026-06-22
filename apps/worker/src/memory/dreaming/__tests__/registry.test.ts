import { describe, expect, it, vi } from 'vitest';

import type { DreamingGate } from '../gate';
import { DreamingGateRegistry } from '../registry';

interface SpyGate extends DreamingGate {
  start: ReturnType<typeof vi.fn>;
  recordActivity: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
}

function fakeGate(): SpyGate {
  return {
    start: vi.fn(),
    recordActivity: vi.fn(),
    stop: vi.fn(),
  } as unknown as SpyGate;
}

describe('DreamingGateRegistry (FIX-013)', () => {
  it('creates and starts a gate lazily on first activity, then forwards recordActivity', () => {
    const gate = fakeGate();
    const create = vi.fn(() => gate);
    const registry = new DreamingGateRegistry({ create });

    registry.recordActivity('u1');

    expect(create).toHaveBeenCalledWith('u1');
    expect(gate.start).toHaveBeenCalledTimes(1);
    expect(gate.recordActivity).toHaveBeenCalledTimes(1);
  });

  it('reuses the existing gate for the same user', () => {
    const gate = fakeGate();
    const create = vi.fn(() => gate);
    const registry = new DreamingGateRegistry({ create });

    registry.recordActivity('u1');
    registry.recordActivity('u1');

    expect(create).toHaveBeenCalledTimes(1);
    expect(gate.recordActivity).toHaveBeenCalledTimes(2);
  });

  it('keeps a separate gate per user', () => {
    const a = fakeGate();
    const b = fakeGate();
    const queue = [a, b];
    const registry = new DreamingGateRegistry({ create: () => queue.shift() as SpyGate });

    registry.recordActivity('u1');
    registry.recordActivity('u2');

    expect(a.recordActivity).toHaveBeenCalledTimes(1);
    expect(b.recordActivity).toHaveBeenCalledTimes(1);
  });

  it('stopAll stops every gate and allows fresh ones afterwards', () => {
    const gate = fakeGate();
    let calls = 0;
    const registry = new DreamingGateRegistry({
      create: () => {
        calls += 1;
        return gate;
      },
    });

    registry.recordActivity('u1');
    registry.stopAll();
    expect(gate.stop).toHaveBeenCalledTimes(1);

    registry.recordActivity('u1');
    expect(calls).toBe(2);
  });
});
