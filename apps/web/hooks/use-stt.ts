'use client';

import { useCallback, useRef, useState } from 'react';

export interface UseSttReturn {
  isRecording: boolean;
  transcript: string;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<string>;
  reset: () => void;
  error: string | null;
}

/** POST the recorded chunks to the transcription endpoint and return the text. */
async function transcribeBlob(chunks: Blob[]): Promise<{ text: string }> {
  const blob = new Blob(chunks, { type: 'audio/webm' });
  const form = new FormData();
  form.append('audio', blob, 'recording.webm');
  const res = await fetch('/api/voice/transcribe', { method: 'POST', body: form });
  if (!res.ok) throw new Error('Transcription failed');
  return (await res.json()) as { text: string };
}

export function useStt(): UseSttReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = useCallback(async () => {
    setError(null);
    chunksRef.current = [];
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
    recorderRef.current = recorder;
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.start(100);
    setIsRecording(true);
  }, []);

  const stopRecording = useCallback(async (): Promise<string> => {
    const recorder = recorderRef.current;
    if (!recorder) return '';
    return new Promise<string>((resolve, reject) => {
      recorder.onstop = () => {
        setIsRecording(false);
        recorderRef.current?.stream.getTracks().forEach((t) => t.stop());
        void transcribeBlob(chunksRef.current)
          .then(({ text }) => {
            setTranscript(text);
            resolve(text);
          })
          .catch((err: unknown) => {
            const msg = err instanceof Error ? err.message : 'STT error';
            setError(msg);
            reject(new Error(msg));
          });
      };
      recorder.stop();
    });
  }, []);

  const reset = useCallback(() => {
    setTranscript('');
    setError(null);
    chunksRef.current = [];
  }, []);

  return { isRecording, transcript, startRecording, stopRecording, reset, error };
}
