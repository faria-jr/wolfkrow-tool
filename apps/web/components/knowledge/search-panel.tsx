'use client';

import { Search } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface SearchResultItem {
  chunkId: string;
  documentId: string;
  content: string;
  score: number;
  metadata: { sourceType?: string; heading?: string };
}

function SearchResultCard({ r, i }: { r: SearchResultItem; i: number }) {
  return (
    <div className="rounded-lg border p-4 space-y-1">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          [{i + 1}] {r.metadata.sourceType ?? 'text'}
          {r.metadata.heading ? ` — ${r.metadata.heading}` : ''}
        </p>
        <span className="shrink-0 text-xs text-muted-foreground">score: {r.score.toFixed(3)}</span>
      </div>
      <p className="text-sm line-clamp-4">{r.content}</p>
      <p className="text-xs text-muted-foreground font-mono">doc:{r.documentId.slice(0, 8)}…</p>
    </div>
  );
}

export function SearchPanel() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [searched, setSearched] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const res = await fetch('/api/knowledge/search', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim(), limit: 10 }),
      });
      const data = (await res.json()) as { results: SearchResultItem[] };
      setResults(data.results ?? []);
      setSearched(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          placeholder="Search your documents…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void handleSearch(); }}
          className="flex-1"
        />
        <Button onClick={() => void handleSearch()} disabled={loading || !query.trim()}>
          <Search className="mr-2 h-4 w-4" />
          {loading ? 'Searching…' : 'Search'}
        </Button>
      </div>

      {searched && results.length === 0 && (
        <p className="text-center text-sm text-muted-foreground">No results found.</p>
      )}

      <div className="space-y-3">
        {results.map((r, i) => <SearchResultCard key={r.chunkId} r={r} i={i} />)}
      </div>
    </div>
  );
}
