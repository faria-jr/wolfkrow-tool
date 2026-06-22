import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useTts } from '../use-tts';

class FakeAudio {
  onended: (() => void) | null = null;
  play = vi.fn().mockResolvedValue(undefined);
  pause = vi.fn();
  currentTime = 0;
}

describe('useTts', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      blob: async () => new Blob(['audio'], { type: 'audio/mpeg' }),
    } as Response);
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('Audio', vi.fn(() => new FakeAudio()));
    vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn().mockReturnValue('blob:fake'), revokeObjectURL: vi.fn() });
  });

  afterEach(() => vi.unstubAllGlobals());

  it('starts idle with no error', () => {
    const { result } = renderHook(() => useTts());
    expect(result.current.isSpeaking).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('speak sets isSpeaking and calls fetch', async () => {
    const { result } = renderHook(() => useTts());
    await act(async () => { await result.current.speak('hello'); });
    expect(fetchMock).toHaveBeenCalledWith('/api/voice/synthesize', expect.objectContaining({ method: 'POST' }));
  });

  it('stop pauses audio without throwing', () => {
    const { result } = renderHook(() => useTts());
    expect(() => act(() => result.current.stop())).not.toThrow();
  });

  it('sets error when synth fails', async () => {
    fetchMock.mockResolvedValue({ ok: false } as Response);
    const { result } = renderHook(() => useTts());
    await act(async () => { await result.current.speak('hi'); });
    await waitFor(() => expect(result.current.error).toBe('TTS failed'));
  });
});
