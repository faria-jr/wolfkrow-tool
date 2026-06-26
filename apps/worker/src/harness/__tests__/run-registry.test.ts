import { describe, expect, it } from 'vitest';

import { abortRun, registerRun, unregisterRun } from '../run-registry';

describe('run-registry (DEBT #29 server abort)', () => {
  it('register returns a checker that is false until abort is called', () => {
    const isAborted = registerRun('proj-1');
    expect(isAborted()).toBe(false);
    expect(abortRun('proj-1')).toBe(true);
    expect(isAborted()).toBe(true);
    unregisterRun('proj-1');
  });

  it('abortRun returns false when no run is registered', () => {
    expect(abortRun('never-registered')).toBe(false);
  });

  it('unregister clears the flag', () => {
    registerRun('proj-2');
    abortRun('proj-2');
    unregisterRun('proj-2');
    // re-register resets to not-aborted
    const fresh = registerRun('proj-2');
    expect(fresh()).toBe(false);
    unregisterRun('proj-2');
  });
});
