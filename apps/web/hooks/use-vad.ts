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

interface VadPipeline {
  stream: MediaStream;
  ctx: AudioContext;
  analyser: AnalyserNode;
  data: Float32Array<ArrayBuffer>;
}

async function createVadPipeline(): Promise<VadPipeline> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const ctx = new AudioContext();
  const source = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 256;
  source.connect(analyser);
  return { stream, ctx, analyser, data: new Float32Array(analyser.fftSize) };
}

interface DetectionOpts {
  analyser: AnalyserNode;
  data: Float32Array<ArrayBuffer>;
  energyThreshold: number;
  silenceThresholdMs: number;
  isSpeakingRef: { current: boolean };
  silenceTimerRef: { current: ReturnType<typeof setTimeout> | null };
  rafRef: { current: number | null };
  onSpeechStart: (() => void) | undefined;
  onSpeechEnd: (() => void) | undefined;
  setIsSpeaking: (v: boolean) => void;
}

function runDetection(o: DetectionOpts): void {
  const tick = () => {
    o.analyser.getFloatTimeDomainData(o.data);
    const rms = Math.sqrt(o.data.reduce((sum, v) => sum + v * v, 0) / o.data.length);
    if (rms > o.energyThreshold) {
      if (o.silenceTimerRef.current) {
        clearTimeout(o.silenceTimerRef.current);
        o.silenceTimerRef.current = null;
      }
      if (!o.isSpeakingRef.current) {
        o.isSpeakingRef.current = true;
        o.setIsSpeaking(true);
        o.onSpeechStart?.();
      }
    } else if (o.isSpeakingRef.current && !o.silenceTimerRef.current) {
      o.silenceTimerRef.current = setTimeout(() => {
        o.isSpeakingRef.current = false;
        o.setIsSpeaking(false);
        o.onSpeechEnd?.();
        o.silenceTimerRef.current = null;
      }, o.silenceThresholdMs);
    }
    o.rafRef.current = requestAnimationFrame(tick);
  };
  o.rafRef.current = requestAnimationFrame(tick);
}

export function useVad(options: UseVadOptions = {}): UseVadReturn {
  const { silenceThresholdMs = 800, energyThreshold = 0.01, onSpeechStart, onSpeechEnd } = options;

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
    const { stream, ctx, analyser, data } = await createVadPipeline();
    streamRef.current = stream;
    contextRef.current = ctx;
    analyserRef.current = analyser;
    runDetection({
      analyser,
      data,
      energyThreshold,
      silenceThresholdMs,
      isSpeakingRef,
      silenceTimerRef,
      rafRef,
      onSpeechStart,
      onSpeechEnd,
      setIsSpeaking,
    });
  }, [energyThreshold, silenceThresholdMs, onSpeechStart, onSpeechEnd]);

  useEffect(
    () => () => {
      stop();
    },
    [stop]
  );

  return { isSpeaking, start, stop };
}
