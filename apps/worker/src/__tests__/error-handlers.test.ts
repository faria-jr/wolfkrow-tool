
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

import { installGlobalErrorHandlers } from '../error-handlers';
import type { Logger } from '../logger';

/**
 * FIX-020: worker must not die silently on unhandled rejections / uncaught
 * exceptions. It must log (with the error) and exit non-zero so the process
 * supervisor restarts it. We capture the listeners registered on `process`
 * and invoke them directly — real registration + real exit would terminate
 * the test runner.
 */
describe('installGlobalErrorHandlers (FIX-020)', () => {
  const listeners = new Map<string, ((...args: unknown[]) => void) | undefined>();
  // Loose mock shape — avoids vitest/process.exit overload typing fights.
  type LooseMock = {
    mockImplementation(fn: (...args: unknown[]) => unknown): unknown;
    toHaveBeenCalledWith(...args: unknown[]): boolean;
  };
  let exitSpy: LooseMock;

  beforeEach(() => {
    listeners.clear();
    vi.spyOn(process, 'on').mockImplementation(((event: string, cb: (...a: unknown[]) => void) => {
      listeners.set(event, cb);
      return process;
    }) as never);
    exitSpy = vi.spyOn(process, 'exit') as unknown as LooseMock;
    exitSpy.mockImplementation((() => {
      throw new Error('__EXIT_CALLED__');
    }) as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function makeLogger(): Logger {
    return { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn(), trace: vi.fn(), fatal: vi.fn(), child: vi.fn() } as unknown as Logger;
  }

  it('registers unhandledRejection and uncaughtException listeners', () => {
    installGlobalErrorHandlers(makeLogger());
    expect(listeners.has('unhandledRejection')).toBe(true);
    expect(listeners.has('uncaughtException')).toBe(true);
  });

  it('logs and exits(1) on unhandledRejection', () => {
    const logger = makeLogger();
    installGlobalErrorHandlers(logger);
    const handler = listeners.get('unhandledRejection')!;

    expect(() => handler(new Error('rejected promise'))).toThrow('__EXIT_CALLED__');
    expect(logger.error).toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('logs and exits(1) on uncaughtException', () => {
    const logger = makeLogger();
    installGlobalErrorHandlers(logger);
    const handler = listeners.get('uncaughtException')!;

    expect(() => handler(new Error('boom'))).toThrow('__EXIT_CALLED__');
    expect(logger.error).toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
