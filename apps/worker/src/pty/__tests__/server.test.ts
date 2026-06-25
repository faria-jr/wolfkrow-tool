/**
 * PtyServer — unit coverage with a mocked node-pty spawn.
 *
 * node-pty cannot spawn a real shell in CI/sandbox. We mock `spawn` to return
 * a minimal fake IPty whose onData/onExit callbacks the test can trigger, so
 * the PtyServer listener fan-out, session lifecycle, and idempotency paths are
 * genuinely exercised.
 */

import { EventEmitter } from 'node:events';
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';

const { fakePty, spawnMock } = vi.hoisted(() => {
  // Each `spawn` call produces a fresh fake PTY bound to its own emitter so
  // tests can drive onData/onExit independently.
  function makeFakePty() {
    const ee = new EventEmitter();
    const fake = {
      write: vi.fn(),
      resize: vi.fn(),
      kill: vi.fn(),
      onData: vi.fn((cb: (d: string) => void) => {
        ee.on('data', cb);
        return () => ee.off('data', cb);
      }),
      onExit: vi.fn((cb: (e: { exitCode: number }) => void) => {
        ee.on('exit', cb);
        return () => ee.off('exit', cb);
      }),
      emitData: (d: string) => ee.emit('data', d),
      emitExit: (code: number) => ee.emit('exit', { exitCode: code }),
      pid: 4242,
    };
    return fake;
  }
  let current: ReturnType<typeof makeFakePty> | null = null;
  const spawnMock = vi.fn(() => {
    current = makeFakePty();
    return current;
  });
  return { fakePty: { current: () => current, makeFakePty }, spawnMock };
});

vi.mock('node-pty', () => ({ spawn: spawnMock }));

import { PtyServer } from '../server';

let server: InstanceType<typeof PtyServer>;

beforeEach(() => {
  server = new PtyServer();
});

afterAll(() => {
  vi.restoreAllMocks();
});

describe('PtyServer', () => {
  it('create spawns a session tracked by has()', () => {
    server.create('s1', { cols: 80, rows: 24 });
    expect(server.has('s1')).toBe(true);
    expect(spawnMock).toHaveBeenCalled();
  });

  it('create replaces an existing session with the same id (kills the old one)', () => {
    server.create('s1', { cols: 80, rows: 24 });
    const first = fakePty.current()!;
    server.create('s1', { cols: 100, rows: 30 });
    expect(first.kill).toHaveBeenCalled();
    expect(server.has('s1')).toBe(true);
  });

  it('onData listeners receive data emitted by the pty', () => {
    server.create('data-sess', { cols: 80, rows: 24 });
    const pty = fakePty.current()!;
    let received = '';
    const off = server.onData('data-sess', (d) => {
      received += d;
    });
    pty.emitData('hello');
    expect(received).toBe('hello');
    off();
    pty.emitData('world');
    expect(received).toBe('hello');
  });

  it('onData returns a no-op unsubscribe for an unknown session', () => {
    const off = server.onData('missing', () => undefined);
    expect(typeof off).toBe('function');
    expect(() => off()).not.toThrow();
  });

  it('onExit fires with the exit code and auto-removes the session', () => {
    server.create('exit-sess', { cols: 80, rows: 24 });
    const pty = fakePty.current()!;
    let code: number | null = null;
    server.onExit('exit-sess', (c) => {
      code = c;
    });
    pty.emitExit(0);
    expect(code).toBe(0);
    // onExit handler deletes the session from the map.
    expect(server.has('exit-sess')).toBe(false);
  });

  it('onExit returns a no-op unsubscribe for an unknown session', () => {
    const off = server.onExit('missing', () => undefined);
    expect(() => off()).not.toThrow();
  });

  it('write delegates to the underlying pty', () => {
    server.create('w', { cols: 80, rows: 24 });
    server.write('w', 'ls\n');
    expect(fakePty.current()!.write).toHaveBeenCalledWith('ls\n');
  });

  it('resize delegates to the underlying pty', () => {
    server.create('r', { cols: 80, rows: 24 });
    server.resize('r', 120, 40);
    expect(fakePty.current()!.resize).toHaveBeenCalledWith(120, 40);
  });

  it('kill removes the session; a second kill is a no-op', () => {
    server.create('k', { cols: 80, rows: 24 });
    const pty = fakePty.current()!;
    server.kill('k');
    expect(pty.kill).toHaveBeenCalled();
    expect(server.has('k')).toBe(false);
    expect(() => server.kill('k')).not.toThrow();
  });

  it('killAll removes every session', () => {
    server.create('a', { cols: 80, rows: 24 });
    server.create('b', { cols: 80, rows: 24 });
    server.killAll();
    expect(server.has('a')).toBe(false);
    expect(server.has('b')).toBe(false);
  });
});
