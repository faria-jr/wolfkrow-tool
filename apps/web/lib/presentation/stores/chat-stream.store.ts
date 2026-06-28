import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

/**
 * Chat Stream Store
 *
 * Holds ephemeral SSE chunks for the active chat session.
 * Server data (sessions, messages) is fetched via TanStack Query.
 */

export interface StreamChunk {
  type: 'start' | 'text' | 'tool_call' | 'tool_result' | 'usage' | 'done' | 'error';
  // Discriminated union — narrow in components
  [key: string]: unknown;
}

interface ChatStreamState {
  isStreaming: boolean;
  currentSessionId: string | null;
  chunks: StreamChunk[];

  start: (sessionId: string) => void;
  appendChunk: (chunk: StreamChunk) => void;
  stop: () => void;
  clear: () => void;
}

export const useChatStreamStore = create<ChatStreamState>()(
  devtools(
    (set) => ({
      isStreaming: false,
      currentSessionId: null,
      chunks: [],

      start: (sessionId) =>
        set({ isStreaming: true, currentSessionId: sessionId, chunks: [] }, false, 'stream/start'),

      appendChunk: (chunk) =>
        set((state) => ({ chunks: [...state.chunks, chunk] }), false, 'stream/append'),

      stop: () => set({ isStreaming: false }, false, 'stream/stop'),

      clear: () =>
        set({ chunks: [], currentSessionId: null, isStreaming: false }, false, 'stream/clear'),
    }),
    { name: 'chat-stream' }
  )
);
