import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../use-stt', () => ({
  useStt: () => ({
    isRecording: false,
    transcript: '',
    startRecording: vi.fn().mockResolvedValue(undefined),
    stopRecording: vi.fn().mockResolvedValue('hello'),
    reset: vi.fn(),
    error: null,
  }),
}));

vi.mock('../use-tts', () => ({
  useTts: () => ({
    isSpeaking: false,
    speak: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn(),
    error: null,
  }),
}));

vi.mock('../use-vad', () => ({
  useVad: () => ({
    isSpeaking: false,
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn(),
  }),
}));

import { useVoiceConversation } from '../use-voice-conversation';

describe('useVoiceConversation', () => {
  it('starts idle with no messages', () => {
    const { result } = renderHook(() => useVoiceConversation());
    expect(result.current.state).toBe('idle');
    expect(result.current.messages).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it('start moves to listening state', async () => {
    const { result } = renderHook(() => useVoiceConversation());
    await act(async () => {
      await result.current.start();
    });
    expect(result.current.state).toBe('listening');
  });

  it('stop returns to idle', async () => {
    const { result } = renderHook(() => useVoiceConversation());
    await act(async () => {
      await result.current.start();
    });
    act(() => result.current.stop());
    expect(result.current.state).toBe('idle');
  });
});
