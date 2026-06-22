'use client';

import { useCallback, useState } from 'react';


import { useStt } from './use-stt';
import { useTts } from './use-tts';
import { useVad } from './use-vad';

import { readChatStream } from '@/lib/chat-stream';

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

async function fetchAssistantResponse(transcript: string, agentId?: string): Promise<string> {
  return readChatStream(transcript, agentId);
}

interface SpeechEndParams {
  state: VoiceConversationState;
  setState: (s: VoiceConversationState) => void;
  stopRecording: () => Promise<string>;
  addMessage: (msg: VoiceConversationMessage) => void;
  speak: (text: string) => Promise<void>;
  resetStt: () => void;
  startRecording: () => Promise<void>;
  setError: (e: string | null) => void;
  agentId: string | undefined;
}

async function processSpeechEnd(p: SpeechEndParams): Promise<void> {
  if (p.state !== 'listening') return;
  p.setState('processing');
  try {
    const transcript = await p.stopRecording();
    if (!transcript.trim()) { p.setState('listening'); return; }
    p.addMessage({ role: 'user', text: transcript });
    const assistantText = await fetchAssistantResponse(transcript, p.agentId);
    p.addMessage({ role: 'assistant', text: assistantText });
    p.setState('speaking');
    await p.speak(assistantText);
    p.setState('listening');
    p.resetStt();
    await p.startRecording();
  } catch (err) {
    p.setError(err instanceof Error ? err.message : 'Voice error');
    p.setState('idle');
  }
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

  const handleSpeechEnd = useCallback(() => {
    void processSpeechEnd({ state, setState, stopRecording, addMessage, speak, resetStt, startRecording, setError, agentId: options.agentId });
  }, [state, stopRecording, addMessage, options.agentId, speak, resetStt, startRecording]);

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
