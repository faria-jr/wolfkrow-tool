import { afterEach, describe, expect, it } from 'vitest';

import {
  abortRun,
  pauseRun,
  registerRun,
  resumeRun,
  runState,
  unregisterRun,
} from '../run-control';

const RUN_ID = 'phase-run-1';

afterEach(() => {
  unregisterRun(RUN_ID);
});

describe('run-control', () => {
  it('registerRun starts in running state with not-aborted/not-paused', () => {
    const handle = registerRun(RUN_ID);
    expect(runState(RUN_ID)).toBe('running');
    expect(handle.isAborted()).toBe(false);
    expect(handle.isPaused()).toBe(false);
  });

  it('abortRun flips the aborted flag and returns true', () => {
    const handle = registerRun(RUN_ID);
    expect(abortRun(RUN_ID)).toBe(true);
    expect(handle.isAborted()).toBe(true);
    expect(runState(RUN_ID)).toBe('aborted');
  });

  it('abortRun returns false when no run is registered', () => {
    expect(abortRun('nope')).toBe(false);
  });

  it('pause/resume round-trips and waitIfPaused resolves on resume', async () => {
    const handle = registerRun(RUN_ID);
    expect(pauseRun(RUN_ID)).toBe(true);
    expect(handle.isPaused()).toBe(true);
    expect(runState(RUN_ID)).toBe('paused');

    // waitIfPaused blocks while paused.
    let resolved = false;
    const waiter = handle.waitIfPaused().then(() => {
      resolved = true;
    });

    expect(resumeRun(RUN_ID)).toBe(true);
    await waiter;
    expect(resolved).toBe(true);
    expect(handle.isPaused()).toBe(false);
    expect(runState(RUN_ID)).toBe('running');
  });

  it('waitIfPaused returns immediately when not paused', async () => {
    const handle = registerRun(RUN_ID);
    await expect(handle.waitIfPaused()).resolves.toBeUndefined();
  });

  it('pause is a no-op when not running', () => {
    registerRun(RUN_ID);
    pauseRun(RUN_ID);
    expect(pauseRun(RUN_ID)).toBe(false); // already paused
  });

  it('resume is a no-op when not paused', () => {
    registerRun(RUN_ID);
    expect(resumeRun(RUN_ID)).toBe(false);
  });

  it('unregisterRun clears the state', () => {
    registerRun(RUN_ID);
    unregisterRun(RUN_ID);
    expect(runState(RUN_ID)).toBeUndefined();
    expect(abortRun(RUN_ID)).toBe(false);
  });
});
