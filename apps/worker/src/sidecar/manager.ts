/**
 * Sidecar lifecycle manager.
 *
 * Spawns/kills the Open Design sidecar (Next.js on port 5000) as a
 * child process. Implements exponential-backoff auto-restart on crash.
 */

import { spawn, type ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { resolve } from 'path';

export type SidecarStatus = 'stopped' | 'starting' | 'running' | 'crashed';

interface SidecarState {
  status: SidecarStatus;
  pid: number | null;
  startedAt: Date | null;
  restarts: number;
  lastError: string | null;
}

const SIDECAR_DIR = resolve(process.cwd(), '../../apps/sidecar');
const MAX_RESTARTS = 5;
const BACKOFF_BASE_MS = 1000;

export class SidecarManager extends EventEmitter {
  private proc: ChildProcess | null = null;
  private state: SidecarState = {
    status: 'stopped',
    pid: null,
    startedAt: null,
    restarts: 0,
    lastError: null,
  };
  private restartTimer: ReturnType<typeof setTimeout> | null = null;

  getState(): Readonly<SidecarState> {
    return { ...this.state };
  }

  start(): void {
    if (this.state.status === 'running' || this.state.status === 'starting') return;
    this.spawn();
  }

  stop(): void {
    this.cancelRestart();
    if (this.proc) {
      this.proc.removeAllListeners();
      this.proc.kill('SIGTERM');
      this.proc = null;
    }
    this.setState({ status: 'stopped', pid: null, startedAt: null });
  }

  private spawn(): void {
    this.cancelRestart();
    this.setState({ status: 'starting' });

    const proc = spawn('node', ['node_modules/.bin/next', 'start', '--port', '5000'], {
      cwd: SIDECAR_DIR,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env },
    });

    this.proc = proc;
    this.setState({ pid: proc.pid ?? null, startedAt: new Date() });

    proc.stdout?.on('data', (chunk: Buffer) => {
      const line = chunk.toString().trim();
      if (line.includes('ready') || line.includes('started')) {
        this.setState({ status: 'running' });
        this.emit('ready');
      }
    });

    proc.stderr?.on('data', (chunk: Buffer) => {
      this.setState({ lastError: chunk.toString().trim() });
    });

    proc.on('exit', (code) => {
      this.proc = null;
      const wasRunning = this.state.status === 'running';
      this.setState({ status: 'crashed', pid: null, lastError: `exit ${code ?? '?'}` });
      if (wasRunning) this.scheduleRestart();
    });
  }

  private scheduleRestart(): void {
    if (this.state.restarts >= MAX_RESTARTS) {
      this.emit('max-restarts');
      return;
    }
    const delay = BACKOFF_BASE_MS * 2 ** this.state.restarts;
    this.setState({ restarts: this.state.restarts + 1 });
    this.restartTimer = setTimeout(() => this.spawn(), delay);
  }

  private cancelRestart(): void {
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
  }

  private setState(patch: Partial<SidecarState>): void {
    this.state = { ...this.state, ...patch };
    this.emit('state', this.state);
  }
}

export const sidecarManager = new SidecarManager();
