import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useVad } from '../use-vad';

class FakeAnalyser {
  fftSize = 256;
  getFloatTimeDomainData = vi.fn();
  connect = vi.fn();
}

class FakeAudioContext {
  createMediaStreamSource = vi.fn(() => ({ connect: vi.fn() }));
  createAnalyser = vi.fn(() => new FakeAnalyser());
  close = vi.fn().mockResolvedValue(undefined);
}

class FakeMediaDevices {
  getUserMedia = vi.fn().mockResolvedValue({ getTracks: () => [{ stop: vi.fn() }] });
}

describe('useVad', () => {
  beforeEach(() => {
    vi.stubGlobal('AudioContext', FakeAudioContext);
    vi.stubGlobal('navigator', { mediaDevices: new FakeMediaDevices() });
    vi.stubGlobal('requestAnimationFrame', vi.fn().mockReturnValue(1));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
  });

  afterEach(() => vi.unstubAllGlobals());

  it('starts idle', () => {
    const { result } = renderHook(() => useVad());
    expect(result.current.isSpeaking).toBe(false);
  });

  it('start sets up pipeline without throwing', async () => {
    const onSpeechStart = vi.fn();
    const { result } = renderHook(() => useVad({ onSpeechStart }));
    await act(async () => {
      await result.current.start();
    });
    expect(result.current.start).toBeDefined();
  });

  it('stop clears state without throwing', () => {
    const { result } = renderHook(() => useVad());
    expect(() => act(() => result.current.stop())).not.toThrow();
  });
});
