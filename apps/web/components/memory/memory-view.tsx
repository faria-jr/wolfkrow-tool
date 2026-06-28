'use client';

import { useCallback, useEffect, useState } from 'react';

import { MemoryViewBody, type MemoryViewState } from './memory-body';
import type {
  DailySummaryData,
  MemoryData,
  MemorySearchResult,
  MemoryTabKey,
} from './memory-types';
import { buildCompactionContent } from './memory-utils';

export function MemoryView() {
  const state = useMemoryViewState();
  return <MemoryViewBody state={state} />;
}

function useMemoryViewState(): MemoryViewState {
  const state = useMemoryViewBase();
  useMemoryViewEffects(state);
  return state;
}

function useMemoryViewBase(): MemoryViewState {
  const [memories, setMemories] = useState<MemoryData[]>([]);
  const [tab, setTab] = useState<MemoryTabKey>('list');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MemorySearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [compactPending, setCompactPending] = useState(false);
  const [summaries, setSummaries] = useState<DailySummaryData[] | null>(null);
  const [summariesError, setSummariesError] = useState<string | null>(null);

  const loadMemories = useCallback(async () => {
    const res = await fetch('/api/memory', { credentials: 'include' });
    if (res.ok) {
      const data = (await res.json()) as { memories: MemoryData[] };
      setMemories(data.memories ?? []);
    }
  }, []);

  const loadSummaries = useCallback(async () => {
    setSummariesError(null);
    try {
      const res = await fetch('/api/memory/summaries', { credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { summaries: DailySummaryData[] };
      setSummaries(data.summaries ?? []);
    } catch (err) {
      setSummariesError(err instanceof Error ? err.message : 'Failed to load');
      setSummaries([]);
    }
  }, []);

  const search = useCallback(async () => {
    return runSearch(query, setSearching, setResults);
  }, [query]);

  const deleteOne = useCallback(
    async (id: string) => {
      await fetch(`/api/memory/${id}`, { method: 'DELETE', credentials: 'include' });
      await loadMemories();
    },
    [loadMemories]
  );

  const compact = useCallback(async () => {
    return runCompact({ memories, tab, loadSummaries, setTab, setCompactPending });
  }, [memories, tab, loadSummaries]);

  return {
    memories,
    tab,
    query,
    results,
    searching,
    compactPending,
    summaries,
    summariesError,
    loadMemories,
    loadSummaries,
    setTab,
    setQuery,
    search,
    deleteOne,
    compact,
  };
}

function useMemoryViewEffects(state: MemoryViewState): void {
  const { loadMemories, loadSummaries, tab, summaries } = state;
  useEffect(() => {
    void loadMemories();
  }, [loadMemories]);
  useEffect(() => {
    if (tab === 'summaries' && summaries === null) {
      void loadSummaries();
    }
  }, [tab, summaries, loadSummaries]);
}

async function runSearch(
  query: string,
  setSearching: (v: boolean) => void,
  setResults: (r: MemorySearchResult[]) => void
): Promise<void> {
  if (!query.trim()) return;
  setSearching(true);
  try {
    const res = await fetch('/api/memory/search', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, limit: 10 }),
    });
    if (res.ok) setResults(((await res.json()) as { results: MemorySearchResult[] }).results ?? []);
  } finally {
    setSearching(false);
  }
}

async function runCompact(deps: {
  memories: MemoryData[];
  tab: MemoryTabKey;
  loadSummaries: () => Promise<void>;
  setTab: (t: MemoryTabKey) => void;
  setCompactPending: (v: boolean) => void;
}): Promise<void> {
  deps.setCompactPending(true);
  try {
    const content = buildCompactionContent(deps.memories);
    const res = await fetch('/api/memory/summaries', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
    if (res.ok) {
      if (deps.tab === 'summaries') {
        await deps.loadSummaries();
      } else {
        deps.setTab('summaries');
      }
    }
  } finally {
    deps.setCompactPending(false);
  }
}
