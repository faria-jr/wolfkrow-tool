import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useBargeIn } from '../use-barge-in';

describe('useBargeIn', () => {
  it('returns arm and disarm functions', () => {
    const { result } = renderHook(() => useBargeIn());
    expect(typeof result.current.arm).toBe('function');
    expect(typeof result.current.disarm).toBe('function');
  });

  it('trigger calls stop and onBargeIn when armed', () => {
    const onBargeIn = vi.fn();
    const stop = vi.fn();
    const { result } = renderHook(() => useBargeIn({ onBargeIn }));
    act(() => result.current.arm(stop));
    act(() => void (result.current.arm as unknown as { trigger: () => void }).trigger());
    expect(stop).toHaveBeenCalled();
    expect(onBargeIn).toHaveBeenCalled();
  });

  it('trigger does nothing when disarmed', () => {
    const stop = vi.fn();
    const { result } = renderHook(() => useBargeIn());
    act(() => result.current.arm(stop));
    act(() => result.current.disarm());
    act(() => void (result.current.arm as unknown as { trigger: () => void }).trigger());
    expect(stop).not.toHaveBeenCalled();
  });

  it('trigger does nothing when never armed', () => {
    const { result } = renderHook(() => useBargeIn());
    expect(() => act(() => void (result.current.arm as unknown as { trigger: () => void }).trigger())).not.toThrow();
  });
});
