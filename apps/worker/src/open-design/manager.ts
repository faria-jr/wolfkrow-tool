/**
 * EPIC 4.2b — Open Design sidecar lifecycle manager.
 *
 * Spawns the vendored open-design engine (daemon + web) via the engine's own
 * `tools-dev run web` orchestrator, which brings up the daemon HTTP API and
 * the Next.js web UI on separate ports and prints both URLs. The web URL is
 * iframed by the Wolfkrow web app; the daemon URL is driven by
 * {@link OpenDesignClient} (bootstrap/snapshot/lock).
 *
 * Replaces the placeholder Next sidecar (apps/sidecar). Mirrors SidecarManager's
 * state machine + exponential-backoff auto-restart.
 */

import { spawn, type ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { resolve } from 'path';

export type OpenDesignStatus = 'stopped' | 'starting' | 'running' | 'crashed';

export interface OpenDesignState {
  status: OpenDesignStatus;
  pid: number | null;
  webUrl: string | null;
  daemonUrl: string | null;
  startedAt: Date | null;
  restarts: number;
  lastError: string | null;
}

const VENDOR_DIR = resolve(process.cwd(), '../../vendor/open-design');
const TOOLS_DEV_BIN = 'tools/dev/bin/tools-dev.mjs';
const DEFAULT_WEB_PORT = Number(process.env['OD_WEB_PORT'] ?? '7460');
const DEFAULT_DAEMON_PORT = Number(process.env['OD_DAEMON_PORT'] ?? '7461');
const DATA_DIR = process.env['OD_DATA_DIR'] ?? resolve(process.cwd(), '../../.od');
const MAX_RESTARTS = 5;
const BACKOFF_BASE_MS = 1000;

const WEB_URL_RE = /Web:\s*(\S+)/;
const DAEMON_URL_RE = /Daemon:\s*(\S+)/;

/**
 * Resolve the vendor dir + spawn args. Exported for testability (allows
 * injecting a fake bin path / overriding the vendor root).
 */
export interface SpawnPlan {
  command: string;
  args: string[];
  cwd: string;
  env: NodeJS.ProcessEnv;
}

export function buildOpenDesignSpawnPlan(opts: { webPort?: number; daemonPort?: number; dataDir?: string } = {}): SpawnPlan {
  const webPort = opts.webPort ?? DEFAULT_WEB_PORT;
  const daemonPort = opts.daemonPort ?? DEFAULT_DAEMON_PORT;
  return {
    command: process.execPath,
    args: [TOOLS_DEV_BIN, 'run', 'web', '--web-port', String(webPort), '--daemon-port', String(daemonPort)],
    cwd: VENDOR_DIR,
    env: { ...process.env, OD_DATA_DIR: opts.dataDir ?? DATA_DIR, OD_EMBED_HOST: 'wolfkrow' },
  };
}

export class OpenDesignSidecarManager extends EventEmitter {
  private proc: ChildProcess | null = null;
  private state: OpenDesignState = {
    status: 'stopped',
    pid: null,
    webUrl: null,
    daemonUrl: null,
    startedAt: null,
    restarts: 0,
    lastError: null,
  };
  private restartTimer: ReturnType<typeof setTimeout> | null = null;
  private spawnFn: (plan: SpawnPlan) => ChildProcess = (plan) =>
    spawn(plan.command, plan.args, { cwd: plan.cwd, stdio: ['ignore', 'pipe', 'pipe'], env: plan.env });

  /** Inject the spawn implementation (tests). */
  withSpawn(fn: (plan: SpawnPlan) => ChildProcess): this {
    this.spawnFn = fn;
    return this;
  }

  getState(): Readonly<OpenDesignState> {
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
    this.setState({ status: 'stopped', pid: null, webUrl: null, daemonUrl: null, startedAt: null });
  }

  private spawn(): void {
    this.cancelRestart();
    this.setState({ status: 'starting', webUrl: null, daemonUrl: null, lastError: null });

    const proc = this.spawnFn(buildOpenDesignSpawnPlan());
    this.proc = proc;
    this.setState({ pid: proc.pid ?? null, startedAt: new Date() });

    proc.stdout?.on('data', (chunk: Buffer) => {
      const line = chunk.toString();
      const webMatch = line.match(WEB_URL_RE);
      const daemonMatch = line.match(DAEMON_URL_RE);
      if (webMatch) this.setState({ webUrl: webMatch[1] ?? null });
      if (daemonMatch) this.setState({ daemonUrl: daemonMatch[1] ?? null });
      // Running once both URLs are captured (more reliable than a "ready" string).
      if (this.state.webUrl && this.state.daemonUrl && this.state.status === 'starting') {
        this.setState({ status: 'running', restarts: 0 });
        this.emit('ready', { webUrl: this.state.webUrl, daemonUrl: this.state.daemonUrl });
      }
    });

    proc.stderr?.on('data', (chunk: Buffer) => {
      this.setState({ lastError: chunk.toString().trim() });
    });

    proc.on('exit', (code) => {
      this.proc = null;
      const wasRunning = this.state.status === 'running';
      this.setState({ status: 'crashed', pid: null, webUrl: null, daemonUrl: null, lastError: `exit ${code ?? '?'}` });
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

  private setState(patch: Partial<OpenDesignState>): void {
    this.state = { ...this.state, ...patch };
    this.emit('state', this.state);
  }
}

export const openDesignManager = new OpenDesignSidecarManager();
