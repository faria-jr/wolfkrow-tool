'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { FixedSizeList as List, type ListChildComponentProps } from 'react-window';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface LogEntry {
  level: string;
  time: number;
  msg: string;
  module?: string;
  reqId?: string;
}

const LEVEL_COLORS: Record<string, string> = {
  trace: 'text-muted-foreground',
  debug: 'text-info',
  info: 'text-success',
  warn: 'text-warning',
  error: 'text-destructive',
  fatal: 'text-destructive font-bold',
};

/** Fixed row height in px — each log line is `py-0.5` mono text-xs (~20px). */
const ROW_HEIGHT = 20;

function fmtTime(ts: number) {
  return new Date(ts).toISOString().replace('T', ' ').slice(0, 23);
}

interface LogFiltersProps {
  levelFilter: string;
  moduleFilter: string;
  paused: boolean;
  onLevelChange: (v: string) => void;
  onModuleChange: (v: string) => void;
  onTogglePause: () => void;
  onClear: () => void;
}
function LogFilters({
  levelFilter,
  moduleFilter,
  paused,
  onLevelChange,
  onModuleChange,
  onTogglePause,
  onClear,
}: LogFiltersProps) {
  return (
    <div className="flex items-center gap-2">
      <Input
        placeholder="level (info/warn/error)"
        value={levelFilter}
        onChange={(e) => onLevelChange(e.target.value)}
        className="w-40"
      />
      <Input
        placeholder="module filter"
        value={moduleFilter}
        onChange={(e) => onModuleChange(e.target.value)}
        className="w-40"
      />
      <Button size="sm" variant="outline" onClick={onTogglePause}>
        {paused ? 'Resume' : 'Pause'}
      </Button>
      <Button size="sm" variant="outline" onClick={onClear}>
        Clear
      </Button>
    </div>
  );
}

/** Per-entry markup, kept identical to the original eager render. */
function LogRow({ index, style, data }: ListChildComponentProps<{ entries: LogEntry[] }>) {
  const e = data.entries[index];
  if (!e) return null;
  return (
    <div
      style={style}
      className={`whitespace-pre-wrap py-0.5 ${LEVEL_COLORS[e.level] ?? 'text-muted-foreground'}`}
    >
      <span className="text-muted-foreground">{fmtTime(e.time)} </span>
      <span className="font-semibold uppercase">[{e.level}] </span>
      {e.module && <span className="text-info">[{e.module}] </span>}
      <span>{e.msg}</span>
    </div>
  );
}

/** Measured container: reports its pixel height to the FixedSizeList via ResizeObserver. */
function useMeasuredHeight() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [height, setHeight] = useState(600);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      const next = entries[0]?.contentRect.height;
      if (next && next > 0) setHeight(next);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return { ref, height };
}

/** Owns the EventSource lifecycle scoped to the active filters + pause state. */
function useLogStream(
  levelFilter: string,
  moduleFilter: string,
  paused: boolean,
  onEntry: (entry: LogEntry) => void
) {
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const qs = new URLSearchParams();
    if (levelFilter) qs.set('level', levelFilter);
    if (moduleFilter) qs.set('module', moduleFilter);

    const es = new EventSource(`/api/logs/stream?${qs.toString()}`);
    esRef.current = es;

    es.onmessage = (ev) => {
      if (paused) return;
      onEntry(JSON.parse(ev.data as string) as LogEntry);
    };

    return () => {
      es.close();
    };
  }, [levelFilter, moduleFilter, paused, onEntry]);
}

export function LogViewer() {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [paused, setPaused] = useState(false);
  const [levelFilter, setLevelFilter] = useState('');
  const [moduleFilter, setModuleFilter] = useState('');
  const listRef = useRef<List | null>(null);
  const { ref: containerRef, height } = useMeasuredHeight();

  const handleEntry = useCallback((entry: LogEntry) => {
    setEntries((prev) => [...prev.slice(-999), entry]);
  }, []);
  useLogStream(levelFilter, moduleFilter, paused, handleEntry);

  useEffect(() => {
    if (!paused && entries.length > 0) {
      listRef.current?.scrollToItem(entries.length - 1, 'end');
    }
  }, [entries, paused]);

  return (
    <div className="flex h-full flex-col gap-2">
      <LogFilters
        levelFilter={levelFilter}
        moduleFilter={moduleFilter}
        paused={paused}
        onLevelChange={setLevelFilter}
        onModuleChange={setModuleFilter}
        onTogglePause={() => setPaused((p) => !p)}
        onClear={() => setEntries([])}
      />

      <div
        ref={containerRef}
        className="min-h-0 flex-1 overflow-hidden rounded border bg-black p-2 font-mono text-xs"
      >
        <List
          ref={listRef}
          height={height}
          width="100%"
          itemCount={entries.length}
          itemSize={ROW_HEIGHT}
          itemData={{ entries }}
        >
          {LogRow}
        </List>
      </div>
    </div>
  );
}
