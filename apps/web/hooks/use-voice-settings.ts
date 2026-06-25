'use client';

import type { STTProvider, VoiceProvider } from '@wolfkrow/shared-types';
import { useCallback, useEffect, useState } from 'react';

/**
 * Persisted voice preferences — the STT/TTS engines the chat voice orb uses.
 *
 * Mirrors the canonical VoiceSettings + STTSettings fields from shared-types
 * (provider, voiceId, speed, stability, similarityBoost / STT provider+model).
 * There is no backend settings store yet, so we persist to localStorage and
 * the chat voice hooks read these values when calling the voice endpoints.
 */

const STORAGE_KEY = 'wolfkrow.voice-settings.v1';

export interface VoiceSettingsState {
  /** TTS provider (ElevenLabs / Cartesia). */
  provider: VoiceProvider;
  /** TTS voice id, forwarded to the synthesize endpoint. */
  voiceId: string;
  /** TTS speed multiplier (0.5–2). */
  speed: number;
  /** TTS stability (0–1, ElevenLabs). */
  stability: number;
  /** TTS similarity boost (0–1, ElevenLabs). */
  similarityBoost: number;
  /** STT engine (Whisper local / OpenAI Whisper). */
  sttProvider: STTProvider;
  /** STT model name (e.g. whisper-1). */
  sttModel: string;
}

export const DEFAULT_VOICE_SETTINGS: VoiceSettingsState = {
  provider: 'elevenlabs',
  voiceId: '',
  speed: 1,
  stability: 0.5,
  similarityBoost: 0.5,
  sttProvider: 'openai-whisper',
  sttModel: 'whisper-1',
};

function readStored(): VoiceSettingsState {
  if (typeof window === 'undefined') return DEFAULT_VOICE_SETTINGS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_VOICE_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<VoiceSettingsState>;
    return { ...DEFAULT_VOICE_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_VOICE_SETTINGS;
  }
}

export interface UseVoiceSettingsReturn {
  settings: VoiceSettingsState;
  /** Merge a partial update into the persisted settings. */
  update: (patch: Partial<VoiceSettingsState>) => void;
  /** Reset all voice settings to defaults. */
  reset: () => void;
}

export function useVoiceSettings(): UseVoiceSettingsReturn {
  const [settings, setSettings] = useState<VoiceSettingsState>(DEFAULT_VOICE_SETTINGS);

  // Load persisted values after mount (avoids SSR/hydration mismatch).
  useEffect(() => {
    setSettings(readStored());
  }, []);

  const persist = useCallback((next: VoiceSettingsState) => {
    setSettings(next);
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Storage may be unavailable (private mode) — settings stay in memory.
      }
    }
  }, []);

  const update = useCallback((patch: Partial<VoiceSettingsState>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {
          // ignore — in-memory only
        }
      }
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    persist(DEFAULT_VOICE_SETTINGS);
  }, [persist]);

  return { settings, update, reset };
}
