'use client';

import { useCallback, useRef } from 'react';

export interface UseBargeInOptions {
  onBargeIn?: () => void;
}

export interface UseBargeInReturn {
  arm: (stop: () => void) => void;
  disarm: () => void;
}

export function useBargeIn(options: UseBargeInOptions = {}): UseBargeInReturn {
  const stopFnRef = useRef<(() => void) | null>(null);
  const armedRef = useRef(false);

  const arm = useCallback((stop: () => void) => {
    stopFnRef.current = stop;
    armedRef.current = true;
  }, []);

  const disarm = useCallback(() => {
    armedRef.current = false;
    stopFnRef.current = null;
  }, []);

  // Expose a trigger method that can be called when VAD detects speech while TTS is playing
  const trigger = useCallback(() => {
    if (!armedRef.current || !stopFnRef.current) return;
    stopFnRef.current();
    options.onBargeIn?.();
    disarm();
  }, [options, disarm]);

  // Attach trigger to the returned object so callers can invoke barge-in
  (arm as unknown as { trigger: () => void }).trigger = trigger;

  return { arm, disarm };
}
