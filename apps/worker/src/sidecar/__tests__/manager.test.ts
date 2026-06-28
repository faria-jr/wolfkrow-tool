/**
 * SidecarManager — lifecycle state machine with a mocked child_process.spawn.
 *
 * The real spawn runs `next start` in apps/sidecar — untestable here. Mocking
 * spawn lets us drive the state machine: start→starting→running (on 'ready'
 * stdout), crash→scheduleRestart, stop, max-restarts, and getState shape.
 */

import { EventEmitter } from 'node:events';

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { spawnMock, currentProc } = vi.hoisted(() => {
  let _proc: (FakeProc & { __ee: EventEmitter }) | null = null;
  interface FakeProc extends EventEmitter {
    stdout: EventEmitter;
    stderr: EventEmitter;
    pid: number;
    kill: ReturnType<typeof vi.fn>;
    removeAllListeners: ReturnType<typeof vi.fn>;
  }
  function makeProc() {
    const ee = new EventEmitter();
    const proc = Object.assign(new EventEmitter(), {
      stdout: new EventEmitter(),
      stderr: new EventEmitter(),
      pid: 99999,
      kill: vi.fn(),
      removeAllListeners: vi.fn(),
      __ee: ee,
    }) as FakeProc & { __ee: EventEmitter };
    _proc = proc;
    return proc;
  }
  const spawnMock = vi.fn(makeProc);
  return { spawnMock, currentProc: () => _proc };
});

vi.mock('node:child_process', () => ({ spawn: spawnMock }));

import { SidecarManager } from '../manager';

let manager: InstanceType<typeof SidecarManager>;

beforeEach(() => {
  vi.useFakeTimers();
  spawnMock.mockClear();
  manager = new SidecarManager();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('SidecarManager — state machine', () => {
  it('start() transitions starting and stores pid', () => {
    manager.start();
    const state = manager.getState();
    expect(state.status).toBe('starting');
    expect(state.pid).toBe(99999);
    expect(state.startedAt).not.toBeNull();
    expect(spawnMock).toHaveBeenCalled();
  });

  it('start() is idempotent while starting/running (no second spawn)', () => {
    manager.start();
    manager.start();
    expect(spawnMock).toHaveBeenCalledTimes(1);
  });

  it('emits "ready" and sets running when stdout contains "ready"', () => {
    let ready = false;
    manager.on('ready', () => {
      ready = true;
    });
    manager.start();
    currentProc()!.stdout.emit('data', Buffer.from('ready - started server'));
    expect(ready).toBe(true);
    expect(manager.getState().status).toBe('running');
  });

  it('stderr populates lastError', () => {
    manager.start();
    currentProc()!.stderr.emit('data', Buffer.from('boom'));
    expect(manager.getState().lastError).toBe('boom');
  });

  it('stop() kills the process and resets state to stopped', () => {
    manager.start();
    const proc = currentProc()!;
    manager.stop();
    expect(proc.kill).toHaveBeenCalledWith('SIGTERM');
    const state = manager.getState();
    expect(state.status).toBe('stopped');
    expect(state.pid).toBeNull();
  });

  it('stop() is safe to call when already stopped', () => {
    expect(() => manager.stop()).not.toThrow();
    expect(manager.getState().status).toBe('stopped');
  });

  it('process exit while running schedules a restart with backoff', () => {
    manager.start();
    currentProc()!.stdout.emit('data', Buffer.from('ready'));
    // Simulate crash.
    currentProc()!.emit('exit', 1);
    expect(manager.getState().status).toBe('crashed');
    // Advancing the fake timer triggers the scheduled spawn.
    spawnMock.mockClear();
    vi.advanceTimersByTime(2000);
    expect(spawnMock).toHaveBeenCalled();
  });

  it('process exit while NOT running does not schedule a restart', () => {
    manager.start();
    // Crash before reaching 'running'.
    currentProc()!.emit('exit', 1);
    expect(manager.getState().status).toBe('crashed');
    spawnMock.mockClear();
    vi.advanceTimersByTime(60_000);
    expect(spawnMock).not.toHaveBeenCalled();
  });

  it('emits max-restarts after exceeding MAX_RESTARTS and stops respawning', () => {
    let maxRestarts = false;
    manager.on('max-restarts', () => {
      maxRestarts = true;
    });
    manager.start();
    currentProc()!.stdout.emit('data', Buffer.from('ready'));
    // Force 5 rapid crashes to exhaust MAX_RESTARTS (5).
    for (let i = 0; i < 6; i++) {
      // Each loop: a proc exists after spawn; crash it.
      const proc = currentProc();
      if (proc) {
        proc.stdout.emit('data', Buffer.from('ready'));
        proc.emit('exit', 1);
      }
      vi.advanceTimersByTime(60_000);
    }
    expect(maxRestarts).toBe(true);
  });

  it('getState returns a defensive copy (mutating it does not affect internal state)', () => {
    manager.start();
    const s1 = manager.getState() as { pid: number | null };
    s1.pid = 12345;
    expect(manager.getState().pid).toBe(99999);
  });
});
