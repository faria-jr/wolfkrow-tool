import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAutoLock } from '../use-auto-lock';

const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/',
}));

describe('useAutoLock', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
    mockPush.mockClear();
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('does not lock immediately on mount', () => {
    renderHook(() => useAutoLock());
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('locks after 5 minutes of inactivity', async () => {
    renderHook(() => useAutoLock());
    await act(async () => {
      vi.advanceTimersByTime(5 * 60 * 1000 + 100);
    });
    expect(mockPush).toHaveBeenCalledWith('/unlock');
  });

  it('resets timer on user activity before timeout', async () => {
    renderHook(() => useAutoLock());
    await act(async () => {
      vi.advanceTimersByTime(4 * 60 * 1000);
      document.dispatchEvent(new MouseEvent('mousedown'));
      vi.advanceTimersByTime(4 * 60 * 1000);
    });
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('locks when tab becomes hidden', async () => {
    renderHook(() => useAutoLock());
    await act(async () => {
      Object.defineProperty(document, 'hidden', { value: true, configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
      await Promise.resolve();
    });
    expect(mockPush).toHaveBeenCalledWith('/unlock');
  });

  it('cleans up event listeners on unmount', () => {
    const removeSpy = vi.spyOn(document, 'removeEventListener');
    const { unmount } = renderHook(() => useAutoLock());
    unmount();
    expect(removeSpy).toHaveBeenCalled();
  });
});
