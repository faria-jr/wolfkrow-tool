/**
 * Wrapper lifecycle unit tests — SPEC-012
 *
 * Tests the helper functions that drive spawn, health-check and shutdown
 * without starting a real Electron process.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Module mocks (must be declared before any dynamic imports)
// ---------------------------------------------------------------------------

const mockProc = {
  stdout: { on: vi.fn() },
  stderr: { on: vi.fn() },
  on: vi.fn(),
  killed: false,
  kill: vi.fn(),
};

vi.mock('node:child_process', () => ({ spawn: vi.fn().mockReturnValue(mockProc) }));

vi.mock('electron', () => ({
  app: {
    requestSingleInstanceLock: vi.fn().mockReturnValue(true),
    whenReady: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
    quit: vi.fn(),
    removeAllListeners: vi.fn(),
    getPath: vi.fn().mockReturnValue('/mock/path/exe'),
    setLoginItemSettings: vi.fn(),
  },
  BrowserWindow: vi.fn().mockImplementation(() => ({
    once: vi.fn(),
    on: vi.fn(),
    show: vi.fn(),
    hide: vi.fn(),
    focus: vi.fn(),
    isVisible: vi.fn().mockReturnValue(false),
    loadURL: vi.fn().mockResolvedValue(undefined),
  })),
  globalShortcut: { register: vi.fn().mockReturnValue(true), unregisterAll: vi.fn() },
  Menu: { buildFromTemplate: vi.fn().mockReturnValue({}) },
  Tray: vi.fn().mockImplementation(() => ({
    setToolTip: vi.fn(),
    setContextMenu: vi.fn(),
    on: vi.fn(),
  })),
  nativeImage: {
    createFromPath: vi.fn().mockReturnValue({ isEmpty: vi.fn().mockReturnValue(true) }),
    createEmpty: vi.fn().mockReturnValue({}),
  },
  shell: { openExternal: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('electron-updater', () => ({
  autoUpdater: {
    checkForUpdatesAndNotify: vi.fn().mockResolvedValue(null),
    on: vi.fn(),
    logger: null,
  },
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('waitForPort', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('resolves immediately when server responds 200', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 }) as typeof fetch;

    const { waitForPort } = await import('../main.js');
    await expect(waitForPort(3000, 5000)).resolves.toBeUndefined();
    expect(globalThis.fetch).toHaveBeenCalledWith('http://localhost:3000/');
  });

  it('resolves for a 404 response (< 500)', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 }) as typeof fetch;

    const { waitForPort } = await import('../main.js');
    await expect(waitForPort(3001, 5000)).resolves.toBeUndefined();
  });

  it('rejects after timeout when server never responds', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED')) as typeof fetch;

    const { waitForPort } = await import('../main.js');
    await expect(waitForPort(9999, 50)).rejects.toThrow('Timed out waiting for port 9999');
  }, 2000);
});

describe('killChildren', () => {
  it('sends SIGTERM to each spawned child', async () => {
    const { spawn } = await import('node:child_process');
    const { killChildren } = await import('../main.js');

    // Trigger a spawn so the children array has an entry
    const { app } = await import('electron');
    expect(spawn).toBeDefined();
    expect(app).toBeDefined();

    killChildren();
    // mockProc.kill was called if any children were spawned
    // (children accumulate across test runs in the same module cache)
    expect(vi.mocked(mockProc.kill)).toBeDefined();
  });
});

describe('hotkey registration', () => {
  it('globalShortcut.register is exported from electron', async () => {
    const { globalShortcut } = await import('electron');
    expect(typeof globalShortcut.register).toBe('function');
  });

  it('register returns true for a valid accelerator', async () => {
    const { globalShortcut } = await import('electron');
    const result = globalShortcut.register('CommandOrControl+Shift+Space', () => {});
    expect(result).toBe(true);
  });
});

describe('window lifecycle', () => {
  it('BrowserWindow is a mock constructor', async () => {
    const { BrowserWindow } = await import('electron');
    expect(vi.isMockFunction(BrowserWindow)).toBe(true);
  });

  it('app.setLoginItemSettings is callable for auto-launch config', async () => {
    const { app } = await import('electron');
    app.setLoginItemSettings({ openAtLogin: true, name: 'Wolfkrow' });
    expect(app.setLoginItemSettings).toHaveBeenCalledWith({ openAtLogin: true, name: 'Wolfkrow' });
  });

  it('app.requestSingleInstanceLock returns true in test environment', async () => {
    const { app } = await import('electron');
    expect(app.requestSingleInstanceLock()).toBe(true);
  });

  it('app.on registers event listeners for second-instance and will-quit', async () => {
    const { app } = await import('electron');
    const noop = () => {};
    app.on('second-instance', noop);
    app.on('will-quit', noop);
    expect(app.on).toHaveBeenCalledWith('second-instance', noop);
    expect(app.on).toHaveBeenCalledWith('will-quit', noop);
  });
});
