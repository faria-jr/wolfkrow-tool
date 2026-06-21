'use client';

import { useCallback, useState } from 'react';

import { useStt } from './use-stt';
import { useTts } from './use-tts';
import { useVad } from './use-vad';

export type VoiceConversationState = 'idle' | 'listening' | 'processing' | 'speaking';

export interface VoiceConversationMessage {
  role: 'user' | 'assistant';
  text: string;
}

export interface UseVoiceConversationOptions {
  agentId?: string;
  voice?: string;
  onMessage?: (msg: VoiceConversationMessage) => void;
}

export interface UseVoiceConversationReturn {
  state: VoiceConversationState;
  messages: VoiceConversationMessage[];
  start: () => Promise<void>;
  stop: () => void;
  error: string | null;
}

export function useVoiceConversation(options: UseVoiceConversationOptions = {}): UseVoiceConversationReturn {
  const [state, setState] = useState<VoiceConversationState>('idle');
  const [messages, setMessages] = useState<VoiceConversationMessage[]>([]);
  const [error, setError] = useState<string | null>(null);

  const { startRecording, stopRecording, reset: resetStt } = useStt();
  const { speak, stop: stopTts } = useTts(options.voice !== undefined ? { voice: options.voice } : {});

  const addMessage = useCallback((msg: VoiceConversationMessage) => {
    setMessages((prev) => [...prev, msg]);
    options.onMessage?.(msg);
  }, [options]);

  const handleSpeechEnd = useCallback(async () => {
    if (state !== 'listening') return;
    setState('processing');

    try {
      const transcript = await stopRecording();
      if (!transcript.trim()) { setState('listening'); return; }

      addMessage({ role: 'user', text: transcript });

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: transcript }],
          ...(options.agentId !== undefined ? { agentId: options.agentId } : {}),
        }),
      });

      if (!res.ok) throw new Error('Chat API error');
      const data = await res.json() as { content: string };
      const assistantText = data.content;

      addMessage({ role: 'assistant', text: assistantText });

      setState('speaking');
      await speak(assistantText);
      setState('listening');

      resetStt();
      await startRecording();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Voice error');
      setState('idle');
    }
  }, [state, stopRecording, addMessage, options, speak, resetStt, startRecording]);

  const { start: startVad, stop: stopVad } = useVad({
    onSpeechStart: () => {
      if (state === 'speaking') {
        stopTts();
        setState('listening');
      }
    },
    onSpeechEnd: () => { void handleSpeechEnd(); },
  });

  const start = useCallback(async () => {
    setError(null);
    setState('listening');
    await startVad();
    await startRecording();
  }, [startVad, startRecording]);

  const stop = useCallback(() => {
    stopVad();
    stopTts();
    setState('idle');
    resetStt();
  }, [stopVad, stopTts, resetStt]);

  return { state, messages, start, stop, error };
}
