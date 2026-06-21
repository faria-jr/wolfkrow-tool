import { spawn } from 'node-pty';
import type { IPty } from 'node-pty';

export interface PtyOpts {
  cols: number;
  rows: number;
  cwd?: string;
  shell?: string;
}

interface PtySession {
  pty: IPty;
  onDataListeners: Set<(data: string) => void>;
  onExitListeners: Set<(code: number) => void>;
}

export class PtyServer {
  private sessions = new Map<string, PtySession>();

  create(id: string, opts: PtyOpts): void {
    if (this.sessions.has(id)) this.kill(id);

    const shell = opts.shell ?? process.env['SHELL'] ?? '/bin/bash';
    const pty = spawn(shell, [], {
      name: 'xterm-256color',
      cols: opts.cols,
      rows: opts.rows,
      cwd: opts.cwd ?? process.env['HOME'] ?? '/tmp',
      env: process.env as Record<string, string>,
    });

    const session: PtySession = { pty, onDataListeners: new Set(), onExitListeners: new Set() };
    this.sessions.set(id, session);

    pty.onData((data) => {
      for (const listener of session.onDataListeners) listener(data);
    });

    pty.onExit(({ exitCode }) => {
      for (const listener of session.onExitListeners) listener(exitCode);
      this.sessions.delete(id);
    });
  }

  write(id: string, data: string): void {
    this.sessions.get(id)?.pty.write(data);
  }

  resize(id: string, cols: number, rows: number): void {
    this.sessions.get(id)?.pty.resize(cols, rows);
  }

  kill(id: string): void {
    const session = this.sessions.get(id);
    if (!session) return;
    try { session.pty.kill(); } catch { /* already dead */ }
    this.sessions.delete(id);
  }

  onData(id: string, listener: (data: string) => void): () => void {
    const session = this.sessions.get(id);
    if (!session) return () => {};
    session.onDataListeners.add(listener);
    return () => session.onDataListeners.delete(listener);
  }

  onExit(id: string, listener: (code: number) => void): () => void {
    const session = this.sessions.get(id);
    if (!session) return () => {};
    session.onExitListeners.add(listener);
    return () => session.onExitListeners.delete(listener);
  }

  has(id: string): boolean {
    return this.sessions.has(id);
  }

  killAll(): void {
    for (const id of this.sessions.keys()) this.kill(id);
  }
}

export const ptyServer = new PtyServer();
