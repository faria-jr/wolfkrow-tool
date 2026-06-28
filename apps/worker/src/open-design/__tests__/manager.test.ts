/**
 * Tests: EPIC 4.2b — OpenDesignSidecarManager state machine.
 * Spawn is injected (fake ChildProcess) so we drive start→running (on Web:/
 * Daemon: stdout), stop, crash, and the spawn-plan shape.
 */

import type { ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { buildOpenDesignSpawnPlan, OpenDesignSidecarManager, type SpawnPlan } from '../manager';

interface FakeProc extends EventEmitter {
  stdout: EventEmitter;
  stderr: EventEmitter;
  pid: number;
  kill: ReturnType<typeof vi.fn>;
  removeAllListeners: ReturnType<typeof vi.fn>;
}

function makeFakeProc(): FakeProc {
  return Object.assign(new EventEmitter(), {
    stdout: new EventEmitter(),
    stderr: new EventEmitter(),
    pid: 99999,
    kill: vi.fn(),
    removeAllListeners: vi.fn(),
  }) as FakeProc;
}

describe('buildOpenDesignSpawnPlan', () => {
  it('runs tools-dev with web+daemon ports and embed env', () => {
    const plan = buildOpenDesignSpawnPlan({ webPort: 7460, daemonPort: 7461, dataDir: '/tmp/od' });
    expect(plan.command).toBe(process.execPath);
    expect(plan.args).toEqual([
      'tools/dev/bin/tools-dev.mjs',
      'run',
      'web',
      '--web-port',
      '7460',
      '--daemon-port',
      '7461',
    ]);
    expect(plan.env['OD_DATA_DIR']).toBe('/tmp/od');
    expect(plan.env['OD_EMBED_HOST']).toBe('wolfkrow');
  });
});

describe('OpenDesignSidecarManager — state machine', () => {
  let proc: FakeProc;
  let manager: OpenDesignSidecarManager;

  beforeEach(() => {
    proc = makeFakeProc();
    manager = new OpenDesignSidecarManager().withSpawn(
      (_: SpawnPlan) => proc as unknown as ChildProcess
    );
  });

  it('goes starting→running when Web: and Daemon: URLs appear on stdout', () => {
    const ready = vi.fn();
    manager.on('ready', ready);
    manager.start();
    expect(manager.getState().status).toBe('starting');

    proc.stdout.emit('data', Buffer.from('Open Design dev server ready\n'));
    proc.stdout.emit('data', Buffer.from('  ➜  Web:    http://127.0.0.1:7460/\n'));
    expect(manager.getState().webUrl).toBe('http://127.0.0.1:7460/');
    expect(manager.getState().status).toBe('starting'); // not running until daemon URL too

    proc.stdout.emit('data', Buffer.from('  ➜  Daemon: http://127.0.0.1:7461/\n'));
    expect(manager.getState().status).toBe('running');
    expect(manager.getState().daemonUrl).toBe('http://127.0.0.1:7461/');
    expect(ready).toHaveBeenCalledWith({
      webUrl: 'http://127.0.0.1:7460/',
      daemonUrl: 'http://127.0.0.1:7461/',
    });
  });

  it('stop kills the process and clears URLs', () => {
    manager.start();
    proc.stdout.emit(
      'data',
      Buffer.from('Web: http://127.0.0.1:7460/\nDaemon: http://127.0.0.1:7461/\n')
    );
    expect(manager.getState().status).toBe('running');

    manager.stop();
    expect(proc.kill).toHaveBeenCalledWith('SIGTERM');
    expect(manager.getState().status).toBe('stopped');
    expect(manager.getState().webUrl).toBeNull();
    expect(manager.getState().daemonUrl).toBeNull();
  });

  it('records stderr as lastError without changing status', () => {
    manager.start();
    proc.stderr.emit('data', Buffer.from('non-fatal warn'));
    expect(manager.getState().lastError).toBe('non-fatal warn');
    expect(manager.getState().status).toBe('starting');
  });

  it('transitions to crashed on unexpected exit after running', () => {
    manager.start();
    proc.stdout.emit(
      'data',
      Buffer.from('Web: http://127.0.0.1:7460/\nDaemon: http://127.0.0.1:7461/\n')
    );
    expect(manager.getState().status).toBe('running');

    // Suppress the auto-restart timer (not under test here).
    manager.stop();
    manager.start();
    proc.stdout.emit(
      'data',
      Buffer.from('Web: http://127.0.0.1:7460/\nDaemon: http://127.0.0.1:7461/\n')
    );

    const states: string[] = [];
    manager.on('state', (s) => states.push(s.status));
    proc.emit('exit', 1);
    expect(manager.getState().status).toBe('crashed');
    expect(manager.getState().lastError).toContain('exit 1');
  });
});
