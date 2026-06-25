import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { DEFAULT_VOICE_SETTINGS, useVoiceSettings } from '../use-voice-settings';

describe('useVoiceSettings', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('loads defaults when nothing is persisted', () => {
    const { result } = renderHook(() => useVoiceSettings());
    expect(result.current.settings).toEqual(DEFAULT_VOICE_SETTINGS);
  });

  it('persists an update to localStorage', () => {
    const { result } = renderHook(() => useVoiceSettings());
    act(() => {
      result.current.update({ provider: 'cartesia', voiceId: 'v2' });
    });
    expect(result.current.settings.provider).toBe('cartesia');
    expect(result.current.settings.voiceId).toBe('v2');

    const raw = window.localStorage.getItem('wolfkrow.voice-settings.v1');
    expect(raw, 'settings must be written to localStorage').not.toBeNull();
    const parsed = JSON.parse(raw!) as { provider: string; voiceId: string };
    expect(parsed.provider).toBe('cartesia');
    expect(parsed.voiceId).toBe('v2');
  });

  it('merges partial updates without dropping other fields', () => {
    const { result } = renderHook(() => useVoiceSettings());
    act(() => result.current.update({ speed: 1.5, sttProvider: 'whisper-local' }));
    act(() => result.current.update({ voiceId: 'xyz' }));
    expect(result.current.settings.speed).toBe(1.5);
    expect(result.current.settings.sttProvider).toBe('whisper-local');
    expect(result.current.settings.voiceId).toBe('xyz');
  });

  it('reset restores defaults', () => {
    const { result } = renderHook(() => useVoiceSettings());
    act(() => result.current.update({ provider: 'cartesia', stability: 0.9 }));
    act(() => result.current.reset());
    expect(result.current.settings).toEqual(DEFAULT_VOICE_SETTINGS);
  });

  it('rehydrates persisted values on mount', () => {
    window.localStorage.setItem(
      'wolfkrow.voice-settings.v1',
      JSON.stringify({ ...DEFAULT_VOICE_SETTINGS, provider: 'cartesia', voiceId: 'persisted' }),
    );
    const { result } = renderHook(() => useVoiceSettings());
    // effect rehydrates after first render
    expect(result.current.settings.provider).toBe('cartesia');
    expect(result.current.settings.voiceId).toBe('persisted');
  });
});
