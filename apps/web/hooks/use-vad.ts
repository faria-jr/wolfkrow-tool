'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export interface UseVadOptions {
  silenceThresholdMs?: number;
  energyThreshold?: number;
  onSpeechStart?: () => void;
  onSpeechEnd?: () => void;
}

export interface UseVadReturn {
  isSpeaking: boolean;
  start: () => Promise<void>;
  stop: () => void;
}

export function useVad(options: UseVadOptions = {}): UseVadReturn {
  const {
    silenceThresholdMs = 800,
    energyThreshold = 0.01,
    onSpeechStart,
    onSpeechEnd,
  } = options;

  const [isSpeaking, setIsSpeaking] = useState(false);
  const contextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef = useRef<number | null>(null);
  const isSpeakingRef = useRef(false);

  const stop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    contextRef.current?.close().catch(() => null);
    contextRef.current = null;
    analyserRef.current = null;
    streamRef.current = null;
    isSpeakingRef.current = false;
    setIsSpeaking(false);
  }, []);

  const start = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;

    const ctx = new AudioContext();
    contextRef.current = ctx;

    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    analyserRef.current = analyser;

    const data = new Float32Array(analyser.fftSize);

    function tick() {
      analyser.getFloatTimeDomainData(data);
      const rms = Math.sqrt(data.reduce((sum, v) => sum + v * v, 0) / data.length);

      if (rms > energyThreshold) {
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = null;
        }
        if (!isSpeakingRef.current) {
          isSpeakingRef.current = true;
          setIsSpeaking(true);
          onSpeechStart?.();
        }
      } else if (isSpeakingRef.current) {
        if (!silenceTimerRef.current) {
          silenceTimerRef.current = setTimeout(() => {
            isSpeakingRef.current = false;
            setIsSpeaking(false);
            onSpeechEnd?.();
            silenceTimerRef.current = null;
          }, silenceThresholdMs);
        }
      }

      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
  }, [energyThreshold, silenceThresholdMs, onSpeechStart, onSpeechEnd]);

  useEffect(() => () => { stop(); }, [stop]);

  return { isSpeaking, start, stop };
}
