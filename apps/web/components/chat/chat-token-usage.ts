import { useCallback, useState } from 'react';

/**
 * Tracks token usage reported by the chat SSE `done` event (F3.6 token counter).
 * Exposes the last-turn usage + the cumulative session total, plus a reset for
 * "Clear chat".
 */
export interface TokenUsage {
  lastUsage: { inputTokens?: number; outputTokens?: number } | null;
  totalTokens: number;
  onDone: (usage: { inputTokens?: number; outputTokens?: number }) => void;
  reset: () => void;
}

export function useTokenUsage(): TokenUsage {
  const [lastUsage, setLastUsage] = useState<{
    inputTokens?: number;
    outputTokens?: number;
  } | null>(null);
  const [totalTokens, setTotalTokens] = useState(0);
  const onDone = useCallback(
    (usage: { inputTokens?: number; outputTokens?: number }) => {
      setLastUsage(usage);
      const sum = (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0);
      if (sum > 0) setTotalTokens((prev) => prev + sum);
    },
    []
  );
  const reset = useCallback(() => {
    setLastUsage(null);
    setTotalTokens(0);
  }, []);
  return { lastUsage, totalTokens, onDone, reset };
}
