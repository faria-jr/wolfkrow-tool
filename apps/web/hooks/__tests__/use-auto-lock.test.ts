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
    mockPush.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not lock immediately on mount', () => {
    renderHook(() => useAutoLock());
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('does not lock after long idle periods', async () => {
    renderHook(() => useAutoLock());
    await act(async () => {
      vi.advanceTimersByTime(30 * 60 * 1000);
    });
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('does not lock when tab becomes hidden', async () => {
    renderHook(() => useAutoLock());
    await act(async () => {
      Object.defineProperty(document, 'hidden', { value: true, configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
      await Promise.resolve();
    });
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('does not register document event listeners', () => {
    const addSpy = vi.spyOn(document, 'addEventListener');
    renderHook(() => useAutoLock());
    expect(addSpy).not.toHaveBeenCalled();
    addSpy.mockRestore();
  });
});
