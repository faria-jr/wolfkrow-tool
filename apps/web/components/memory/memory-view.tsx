'use client';

import { useCallback, useEffect, useState } from 'react';

interface MemoryData {
  id: string;
  content: string;
  source: string;
  importance: number;
  accessCount: number;
  createdAt: string;
}

interface SearchResult {
  memory: MemoryData;
  distance: number;
}

export function MemoryView() {
  const [memories, setMemories] = useState<MemoryData[]>([]);
  const [tab, setTab] = useState<'list' | 'search'>('list');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  const loadMemories = useCallback(async () => {
    const res = await fetch('/api/memory', { credentials: 'include' });
    if (res.ok) {
      const data = (await res.json()) as { memories: MemoryData[] };
      setMemories(data.memories ?? []);
    }
  }, []);

  useEffect(() => { void loadMemories(); }, [loadMemories]);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const res = await fetch('/api/memory/search', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, limit: 10 }),
      });
      if (res.ok) {
        const data = (await res.json()) as { results: SearchResult[] };
        setResults(data.results ?? []);
      }
    } finally {
      setSearching(false);
    }
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/memory/${id}`, { method: 'DELETE', credentials: 'include' });
    void loadMemories();
  };

  const sourceColor: Record<string, string> = {
    user: 'bg-blue-100 text-blue-800',
    agent: 'bg-purple-100 text-purple-800',
    conversation: 'bg-green-100 text-green-800',
    compaction: 'bg-amber-100 text-amber-800',
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Memory</h1>
        <p className="text-muted-foreground text-sm">
          Semantic memories extracted from conversations and stored for recall.
        </p>
      </div>

      <div className="flex gap-1 border-b">
        {(['list', 'search'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={[
              'px-4 py-2 text-sm font-medium capitalize transition-colors',
              tab === t
                ? 'border-b-2 border-primary text-primary'
                : 'text-muted-foreground hover:text-foreground',
            ].join(' ')}
          >
            {t}
            {t === 'list' && memories.length > 0 && (
              <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-xs">
                {memories.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === 'list' && (
        <div className="space-y-3">
          {memories.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center text-sm">No memories yet.</p>
          ) : (
            memories.map((m) => (
              <div key={m.id} className="bg-card flex items-start justify-between rounded-lg border p-4">
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-sm">{m.content}</p>
                  <div className="flex items-center gap-2 text-xs">
                    <span className={`rounded px-1.5 py-0.5 font-medium ${sourceColor[m.source] ?? 'bg-gray-100 text-gray-700'}`}>
                      {m.source}
                    </span>
                    <span className="text-muted-foreground">importance: {m.importance}</span>
                    <span className="text-muted-foreground">accessed: {m.accessCount}×</span>
                    <span className="text-muted-foreground">{new Date(m.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
                <button
                  onClick={() => void handleDelete(m.id)}
                  className="text-muted-foreground hover:text-destructive ml-4 text-xs transition-colors"
                >
                  delete
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'search' && (
        <div className="space-y-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void handleSearch(); }}
              placeholder="Search memories…"
              className="border-input bg-background flex-1 rounded-md border px-3 py-2 text-sm outline-none"
            />
            <button
              onClick={() => void handleSearch()}
              disabled={searching}
              className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {searching ? 'Searching…' : 'Search'}
            </button>
          </div>

          {results.length === 0 && !searching && query && (
            <p className="text-muted-foreground text-sm">No results found.</p>
          )}

          <div className="space-y-3">
            {results.map((r, i) => (
              <div key={r.memory.id} className="bg-card rounded-lg border p-4">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-muted-foreground text-xs">#{i + 1} — distance: {r.distance.toFixed(4)}</span>
                  <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${sourceColor[r.memory.source] ?? 'bg-gray-100 text-gray-700'}`}>
                    {r.memory.source}
                  </span>
                </div>
                <p className="text-sm">{r.memory.content}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
