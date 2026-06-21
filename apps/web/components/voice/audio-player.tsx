'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface AudioPlayerProps {
  src?: string;
  autoPlay?: boolean;
  onEnded?: () => void;
}

export function AudioPlayer({ src, autoPlay, onEnded }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !src) return;
    audio.src = src;
    if (autoPlay) { void audio.play(); }
  }, [src, autoPlay]);

  const handleTimeUpdate = useCallback(() => {
    const audio = audioRef.current;
    if (audio) setProgress((audio.currentTime / audio.duration) * 100);
  }, []);

  const handleToggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) { audio.pause(); } else { void audio.play(); }
  }, [isPlaying]);

  if (!src) return null;

  return (
    <div className="flex items-center gap-3 rounded border px-3 py-2">
      <audio
        ref={audioRef}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => { setIsPlaying(false); onEnded?.(); }}
        onLoadedMetadata={(e) => setDuration((e.target as HTMLAudioElement).duration)}
        onTimeUpdate={handleTimeUpdate}
      />
      <button
        onClick={handleToggle}
        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-500 text-white hover:bg-blue-600"
        aria-label={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? (
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
        ) : (
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
        )}
      </button>
      <div className="flex-1">
        <div className="h-1.5 rounded-full bg-gray-200">
          <div className="h-1.5 rounded-full bg-blue-500 transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>
      <span className="text-xs text-gray-500">{duration > 0 ? `${Math.round(duration)}s` : ''}</span>
    </div>
  );
}
