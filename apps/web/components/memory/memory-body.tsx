'use client';

import type { DailySummaryData, MemoryData, MemorySearchResult, MemoryTabKey } from './memory-types';

import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';

const SOURCE_COLOR: Record<string, string> = {
  user: 'bg-info/15 text-info',
  agent: 'bg-primary/15 text-primary',
  conversation: 'bg-success/15 text-success',
  compaction: 'bg-warning/15 text-warning',
};

export interface MemoryViewState {
  memories: MemoryData[];
  tab: MemoryTabKey;
  query: string;
  results: MemorySearchResult[];
  searching: boolean;
  compactPending: boolean;
  summaries: DailySummaryData[] | null;
  summariesError: string | null;
  loadMemories: () => Promise<void>;
  loadSummaries: () => Promise<void>;
  setTab: (t: MemoryTabKey) => void;
  setQuery: (q: string) => void;
  search: () => Promise<void>;
  deleteOne: (id: string) => Promise<void>;
  compact: () => Promise<void>;
}

interface TabNavProps { tab: MemoryTabKey; setTab: (t: MemoryTabKey) => void; count: number; }
export function MemoryTabNav({ tab, setTab, count }: TabNavProps) {
  return (
    <div className="flex gap-1 border-b">
      {(['list', 'search', 'summaries'] as const).map((t) => (
        <button
          key={t}
          onClick={() => setTab(t)}
          className={[
            'px-4 py-2 text-sm font-medium capitalize transition-colors',
            tab === t ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground',
          ].join(' ')}
        >
          {t}
          {t === 'list' && count > 0 && <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-xs">{count}</span>}
        </button>
      ))}
    </div>
  );
}

interface ListTabProps { memories: MemoryData[]; onDelete: (id: string) => void; onCompact: () => void; compacting: boolean; }
export function MemoryListTab({ memories, onDelete, onCompact, compacting }: ListTabProps) {
  if (memories.length === 0)
    return (
      <EmptyState
        title="No memories yet"
        description="Memories are extracted from conversations and stored for recall."
      />
    );
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={onCompact}
          disabled={compacting}
          data-testid="compact-now"
          className="rounded-md bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
          title="Create a daily summary of recent memories"
        >
          {compacting ? 'Compacting…' : 'Compact now'}
        </button>
      </div>
      {memories.map((m) => (
        <div key={m.id} className="bg-card flex items-start justify-between rounded-lg border p-4">
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-sm">{m.content}</p>
            <div className="flex items-center gap-2 text-xs">
              <span className={`rounded px-1.5 py-0.5 font-medium ${SOURCE_COLOR[m.source] ?? 'bg-muted text-muted-foreground'}`}>{m.source}</span>
              <span className="text-muted-foreground">importance: {m.importance}</span>
              <span className="text-muted-foreground">accessed: {m.accessCount}×</span>
              <span className="text-muted-foreground">{new Date(m.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
          <button onClick={() => onDelete(m.id)} className="text-muted-foreground hover:text-destructive ml-4 text-xs transition-colors">delete</button>
        </div>
      ))}
    </div>
  );
}

interface SearchTabProps { results: MemorySearchResult[]; query: string; onQueryChange: (q: string) => void; onSearch: () => void; searching: boolean; }
export function MemorySearchTab({ results, query, onQueryChange, onSearch, searching }: SearchTabProps) {
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') onSearch(); }}
          placeholder="Search memories…"
          className="border-input bg-background flex-1 rounded-md border px-3 py-2 text-sm outline-none"
        />
        <button onClick={onSearch} disabled={searching} className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50">
          {searching ? 'Searching…' : 'Search'}
        </button>
      </div>
      {results.length === 0 && !searching && query && <p className="text-muted-foreground text-sm">No results found.</p>}
      <div className="space-y-3">
        {results.map((r, i) => (
          <div key={r.memory.id} className="bg-card rounded-lg border p-4">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-muted-foreground text-xs">#{i + 1} — distance: {r.distance.toFixed(4)}</span>
              <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${SOURCE_COLOR[r.memory.source] ?? 'bg-gray-100 text-gray-700'}`}>{r.memory.source}</span>
            </div>
            <p className="text-sm">{r.memory.content}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

interface SummariesTabProps { summaries: DailySummaryData[] | null; error: string | null; onReload: () => void; }
export function MemorySummariesTab({ summaries, error, onReload }: SummariesTabProps) {
  if (error) {
    return (
      <ErrorState
        title="Failed to load summaries"
        description={error}
        retryLabel="Retry"
        onRetry={onReload}
      />
    );
  }
  if (summaries === null) {
    return <p className="text-muted-foreground py-8 text-center text-sm">Loading summaries…</p>;
  }
  if (summaries.length === 0) {
    return (
      <EmptyState
        title="No daily summaries yet"
        description='Click "Compact now" on the List tab to create one.'
      />
    );
  }
  return (
    <div className="space-y-3" data-testid="daily-summaries">
      {summaries.map((s) => (
        <div key={s.id} className="bg-card rounded-lg border p-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-medium">{s.date}</h3>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{s.sessionCount} sessions</span>
              <span>·</span>
              <span>{s.tokensUsed} tokens</span>
              <span>·</span>
              <span>${s.cost.toFixed(4)}</span>
            </div>
          </div>
          <p className="text-sm whitespace-pre-wrap">{s.content}</p>
        </div>
      ))}
    </div>
  );
}

interface MemoryViewBodyProps { state: MemoryViewState; }
export function MemoryViewBody({ state }: MemoryViewBodyProps) {
  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Memory</h1>
        <p className="text-muted-foreground text-sm">Semantic memories extracted from conversations and stored for recall.</p>
      </div>
      <MemoryTabNav tab={state.tab} setTab={state.setTab} count={state.memories.length} />
      {state.tab === 'list' && (
        <MemoryListTab
          memories={state.memories}
          onDelete={(id) => { void state.deleteOne(id); }}
          onCompact={() => { void state.compact(); }}
          compacting={state.compactPending}
        />
      )}
      {state.tab === 'search' && (
        <MemorySearchTab
          results={state.results}
          query={state.query}
          onQueryChange={state.setQuery}
          onSearch={() => { void state.search(); }}
          searching={state.searching}
        />
      )}
      {state.tab === 'summaries' && (
        <MemorySummariesTab
          summaries={state.summaries}
          error={state.summariesError}
          onReload={() => { void state.loadSummaries(); }}
        />
      )}
    </div>
  );
}
