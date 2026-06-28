import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useStt } from '../use-stt';

class FakeMediaRecorder {
  ondataavailable: ((e: { data: { size: number } }) => void) | null = null;
  onstop: (() => void) | null = null;
  start = vi.fn();
  stop = vi.fn();
  stream = { getTracks: () => [{ stop: vi.fn() }] };
}

class FakeMediaDevices {
  getUserMedia = vi.fn().mockResolvedValue({ getTracks: () => [] });
}

describe('useStt', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ text: 'transcribed' }),
    } as Response);
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('MediaRecorder', FakeMediaRecorder);
    vi.stubGlobal('navigator', { mediaDevices: new FakeMediaDevices() });
    vi.stubGlobal('Blob', Blob);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('starts idle with empty transcript', () => {
    const { result } = renderHook(() => useStt());
    expect(result.current.isRecording).toBe(false);
    expect(result.current.transcript).toBe('');
  });

  it('startRecording sets recording true', async () => {
    const { result } = renderHook(() => useStt());
    await act(async () => {
      await result.current.startRecording();
    });
    expect(result.current.isRecording).toBe(true);
  });

  it('reset clears transcript and error', () => {
    const { result } = renderHook(() => useStt());
    act(() => result.current.reset());
    expect(result.current.transcript).toBe('');
    expect(result.current.error).toBeNull();
  });
});
