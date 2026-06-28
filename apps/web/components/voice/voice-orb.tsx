'use client';

import type { VoiceConversationState } from '@/hooks/use-voice-conversation';

interface VoiceOrbProps {
  state: VoiceConversationState;
  onClick?: () => void;
}

const STATE_STYLES: Record<VoiceConversationState, string> = {
  idle: 'bg-muted hover:bg-muted/80 scale-100',
  listening: 'bg-info scale-110 animate-pulse',
  processing: 'bg-warning scale-105 animate-spin',
  speaking: 'bg-success scale-110',
};

const STATE_ARIA: Record<VoiceConversationState, string> = {
  idle: 'Click to start voice conversation',
  listening: 'Listening…',
  processing: 'Processing…',
  speaking: 'Assistant speaking',
};

export function VoiceOrb({ state, onClick }: VoiceOrbProps) {
  return (
    <button
      onClick={onClick}
      aria-label={STATE_ARIA[state]}
      className={`focus:ring-info h-16 w-16 rounded-full shadow-lg transition-all duration-300 focus:outline-none focus:ring-2 ${STATE_STYLES[state]}`}
    >
      <span className="sr-only">{STATE_ARIA[state]}</span>
      {state === 'listening' && (
        <svg
          viewBox="0 0 24 24"
          className="text-info-foreground mx-auto h-8 w-8"
          fill="currentColor"
        >
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3zm5.3 9.3a.75.75 0 0 1 1.4.4A6.5 6.5 0 0 1 12.75 17v2.25H15a.75.75 0 0 1 0 1.5H9a.75.75 0 0 1 0-1.5h2.25V17A6.5 6.5 0 0 1 5.3 10.7a.75.75 0 0 1 1.4-.4A5 5 0 0 0 17 10.6z" />
        </svg>
      )}
      {state === 'speaking' && (
        <svg
          viewBox="0 0 24 24"
          className="text-success-foreground mx-auto h-8 w-8"
          fill="currentColor"
        >
          <path d="M13 3a1 1 0 0 0-1.447-.894L5.106 5H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.106l6.447 2.894A1 1 0 0 0 13 15V3z" />
          <path d="M15.5 8.5a.5.5 0 0 1 .5-.5 3 3 0 0 1 0 6 .5.5 0 0 1 0-1 2 2 0 0 0 0-4 .5.5 0 0 1-.5-.5z" />
          <path d="M18 6.5a.5.5 0 0 1 .5-.5 5 5 0 0 1 0 10 .5.5 0 0 1 0-1 4 4 0 0 0 0-8 .5.5 0 0 1-.5-.5z" />
        </svg>
      )}
      {(state === 'idle' || state === 'processing') && (
        <svg
          viewBox="0 0 24 24"
          className="text-muted-foreground mx-auto h-8 w-8"
          fill="currentColor"
        >
          <circle cx="12" cy="12" r="4" />
        </svg>
      )}
    </button>
  );
}
