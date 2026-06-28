'use client';

import { useCallback, useRef, useState } from 'react';

export interface UseTtsOptions {
  voice?: string;
  provider?: string;
}

export interface UseTtsReturn {
  isSpeaking: boolean;
  speak: (text: string) => Promise<void>;
  stop: () => void;
  error: string | null;
}

export function useTts(options: UseTtsOptions = {}): UseTtsReturn {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);

  const stop = useCallback(() => {
    audioRef.current?.pause();
    if (audioRef.current) audioRef.current.currentTime = 0;
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
    setIsSpeaking(false);
  }, []);

  const speak = useCallback(
    async (text: string) => {
      stop();
      setError(null);
      setIsSpeaking(true);
      try {
        const res = await fetch('/api/voice/synthesize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, voice: options.voice, provider: options.provider }),
        });
        if (!res.ok) throw new Error('TTS failed');

        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        urlRef.current = url;

        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onended = () => {
          URL.revokeObjectURL(url);
          urlRef.current = null;
          setIsSpeaking(false);
        };
        await audio.play();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'TTS error');
        setIsSpeaking(false);
      }
    },
    [options.voice, options.provider, stop]
  );

  return { isSpeaking, speak, stop, error };
}
