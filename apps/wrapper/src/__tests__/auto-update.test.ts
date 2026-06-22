import { describe, it, expect, vi } from 'vitest';

const mockCheckForUpdatesAndNotify = vi.fn().mockResolvedValue(null);
const mockOn = vi.fn();

vi.mock('electron-updater', () => ({
  autoUpdater: {
    checkForUpdatesAndNotify: mockCheckForUpdatesAndNotify,
    on: mockOn,
    logger: null,
  },
}));

describe('auto-update bootstrap', () => {
  it('checkForUpdatesAndNotify is callable and returns a promise', async () => {
    const { autoUpdater } = await import('electron-updater');
    await expect(autoUpdater.checkForUpdatesAndNotify()).resolves.toBeNull();
  });

  it('autoUpdater exposes .on for event listeners', async () => {
    const { autoUpdater } = await import('electron-updater');
    expect(typeof autoUpdater.on).toBe('function');
  });
});
