'use client';

import { useCallback } from 'react';

import { useStt } from '@/hooks/use-stt';

interface VoiceRecorderProps {
  onTranscript?: (text: string) => void;
}

export function VoiceRecorder({ onTranscript }: VoiceRecorderProps) {
  const { isRecording, transcript, startRecording, stopRecording, reset, error } = useStt();

  const handleToggle = useCallback(async () => {
    if (isRecording) {
      const text = await stopRecording();
      onTranscript?.(text);
    } else {
      reset();
      await startRecording();
    }
  }, [isRecording, stopRecording, startRecording, reset, onTranscript]);

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        onClick={() => {
          void handleToggle();
        }}
        className={`flex h-12 w-12 items-center justify-center rounded-full shadow-md transition-colors ${isRecording ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-500 hover:bg-blue-600'}`}
        aria-label={isRecording ? 'Stop recording' : 'Start recording'}
      >
        {isRecording ? (
          <span className="h-4 w-4 rounded bg-white" />
        ) : (
          <svg viewBox="0 0 24 24" className="h-6 w-6 text-white" fill="currentColor">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
          </svg>
        )}
      </button>
      {transcript && <p className="max-w-xs text-center text-sm text-gray-700">{transcript}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
