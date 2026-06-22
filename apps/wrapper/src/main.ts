/**
 * Wolfkrow Electron wrapper — D.2
 *
 * Responsibilities (≤300 lines total):
 *  - Spawn Next.js web (port 3000) and Fastify worker (port 4000) as child processes.
 *  - Create a BrowserWindow that loads http://localhost:3000.
 *  - System tray with menu: Open, Quick Chat, Lock, Quit.
 *  - Global hotkey: Cmd/Ctrl+Shift+Space → show/hide window.
 *  - Auto-launch on system start (via Electron's openAtLogin).
 *  - Graceful shutdown: kill child processes on quit.
 *
 * Security: sandbox=true, contextIsolation=true, no nodeIntegration.
 */

import { spawn, type ChildProcess } from 'node:child_process';
import { resolve } from 'node:path';

import {
  app,
  BrowserWindow,
  globalShortcut,
  Menu,
  nativeImage,
  shell,
  Tray,
} from 'electron';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const WEB_PORT  = 3000;
const WEB_URL   = `http://localhost:${WEB_PORT}`;
const ROOT_DIR  = resolve(__dirname, '../../..');
const ICON_PATH = resolve(ROOT_DIR, 'resources', 'icon.png');

const HOTKEY = 'CommandOrControl+Shift+Space';
const BOOT_TIMEOUT_MS = 15_000;
const POLL_INTERVAL_MS = 500;

// ---------------------------------------------------------------------------
// Child process management
// ---------------------------------------------------------------------------

interface ManagedProcess {
  name: string;
  proc: ChildProcess;
}

const children: ManagedProcess[] = [];

function spawnChild(name: string, cmd: string, args: string[], cwd: string): ChildProcess {
  const proc = spawn(cmd, args, {
    cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, ELECTRON_RUN_AS_NODE: undefined },
    shell: false,
  });

  proc.stdout?.on('data', (d: Buffer) => {
    process.stdout.write(`[${name}] ${d}`);
  });
  proc.stderr?.on('data', (d: Buffer) => {
    process.stderr.write(`[${name}] ${d}`);
  });
  proc.on('exit', (code) => {
    console.warn(`[${name}] exited with code ${code ?? '?'}`);
  });

  children.push({ name, proc });
  return proc;
}

function killChildren(): void {
  for (const { proc } of children) {
    if (!proc.killed) proc.kill('SIGTERM');
  }
}

// ---------------------------------------------------------------------------
// Wait for port to become reachable
// ---------------------------------------------------------------------------

async function waitForPort(port: number, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://localhost:${port}/`);
      if (res.ok || res.status < 500) return;
    } catch {
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  throw new Error(`Timed out waiting for port ${port}`);
}

// ---------------------------------------------------------------------------
// Window
// ---------------------------------------------------------------------------

let win: BrowserWindow | null = null;

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'Wolfkrow',
    icon: nativeImage.createFromPath(ICON_PATH),
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
    backgroundColor: '#0f0f0f',
    show: false,
  });

  window.once('ready-to-show', () => window.show());
  window.on('close', (e) => {
    e.preventDefault();
    window.hide();
  });

  void window.loadURL(WEB_URL);
  return window;
}

function toggleWindow(): void {
  if (!win) return;
  if (win.isVisible()) {
    win.hide();
  } else {
    win.show();
    win.focus();
  }
}

// ---------------------------------------------------------------------------
// Tray
// ---------------------------------------------------------------------------

let tray: Tray | null = null;

function createTray(window: BrowserWindow): void {
  const icon = nativeImage.createFromPath(ICON_PATH);
  tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon);
  tray.setToolTip('Wolfkrow');

  const menu = Menu.buildFromTemplate([
    {
      label: 'Open Wolfkrow',
      click: () => { window.show(); window.focus(); },
    },
    {
      label: 'Quick Chat',
      accelerator: HOTKEY,
      click: () => { toggleWindow(); },
    },
    {
      label: 'Lock',
      click: () => {
        window.show();
        void window.loadURL(`${WEB_URL}/lock`);
      },
    },
    { type: 'separator' },
    {
      label: 'Open in Browser',
      click: () => { void shell.openExternal(WEB_URL); },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.removeAllListeners('window-all-closed');
        killChildren();
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(menu);
  tray.on('double-click', () => toggleWindow());
}

// ---------------------------------------------------------------------------
// Auto-launch
// ---------------------------------------------------------------------------

function configureAutoLaunch(): void {
  app.setLoginItemSettings({
    openAtLogin: true,
    name: 'Wolfkrow',
    path: app.getPath('exe'),
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  if (!app.requestSingleInstanceLock()) {
    app.quit();
    return;
  }

  app.on('second-instance', () => { win?.show(); win?.focus(); });

  await app.whenReady();

  // Spawn Next.js web server
  spawnChild('web', 'node', ['node_modules/.bin/next', 'start', '--port', String(WEB_PORT)], resolve(ROOT_DIR, 'apps', 'web'));

  // Spawn Fastify worker
  spawnChild('worker', 'node', ['dist/index.js'], resolve(ROOT_DIR, 'apps', 'worker'));

  // Wait for web to boot
  try {
    await waitForPort(WEB_PORT, BOOT_TIMEOUT_MS);
  } catch {
    console.error('Web server failed to start in time — continuing anyway.');
  }

  win = createWindow();
  createTray(win);
  configureAutoLaunch();

  // Global hotkey
  globalShortcut.register(HOTKEY, toggleWindow);

  app.on('activate', () => { win?.show(); win?.focus(); });
  app.on('window-all-closed', () => { /* prevent default quit; tray keeps app alive */ });

  app.on('will-quit', () => {
    globalShortcut.unregisterAll();
    killChildren();
  });
}

main().catch((e) => {
  console.error('Wrapper fatal error:', e);
  app.quit();
});
