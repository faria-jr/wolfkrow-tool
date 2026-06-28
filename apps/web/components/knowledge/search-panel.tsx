'use client';

import { Search } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { searchKnowledge, type KnowledgeSearchItem } from '@/lib/api-client';

function SearchResultCard({ r, i }: { r: KnowledgeSearchItem; i: number }) {
  const meta = r.metadata as { sourceType?: string; heading?: string };
  return (
    <div className="space-y-1 rounded-lg border p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-muted-foreground text-xs">
          [{i + 1}] {meta.sourceType ?? 'text'}
          {meta.heading ? ` — ${meta.heading}` : ''}
        </p>
        <span className="text-muted-foreground shrink-0 text-xs">score: {r.score.toFixed(3)}</span>
      </div>
      <p className="line-clamp-4 text-sm">{r.content}</p>
      <p className="text-muted-foreground font-mono text-xs">doc:{r.documentId.slice(0, 8)}…</p>
    </div>
  );
}

export function SearchPanel() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<KnowledgeSearchItem[]>([]);
  const [searched, setSearched] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      setResults(await searchKnowledge({ query: query.trim(), limit: 10 }));
      setSearched(true);
    } catch {
      setResults([]);
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
          onKeyDown={(e) => {
            if (e.key === 'Enter') void handleSearch();
          }}
          className="flex-1"
        />
        <Button onClick={() => void handleSearch()} disabled={loading || !query.trim()}>
          <Search className="mr-2 h-4 w-4" />
          {loading ? 'Searching…' : 'Search'}
        </Button>
      </div>

      {searched && results.length === 0 && (
        <p className="text-muted-foreground text-center text-sm">No results found.</p>
      )}

      <div className="space-y-3">
        {results.map((r, i) => (
          <SearchResultCard key={r.chunkId} r={r} i={i} />
        ))}
      </div>
    </div>
  );
}
