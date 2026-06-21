'use client';

import { useEffect, useRef, useState } from 'react';

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
  trace: 'text-gray-400',
  debug: 'text-blue-400',
  info: 'text-green-400',
  warn: 'text-yellow-400',
  error: 'text-red-400',
  fatal: 'text-red-600 font-bold',
};

function fmtTime(ts: number) {
  return new Date(ts).toISOString().replace('T', ' ').slice(0, 23);
}

export function LogViewer() {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [paused, setPaused] = useState(false);
  const [levelFilter, setLevelFilter] = useState('');
  const [moduleFilter, setModuleFilter] = useState('');
  const esRef = useRef<EventSource | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const qs = new URLSearchParams();
    if (levelFilter) qs.set('level', levelFilter);
    if (moduleFilter) qs.set('module', moduleFilter);

    const es = new EventSource(`/api/logs/stream?${qs.toString()}`);
    esRef.current = es;

    es.onmessage = (ev) => {
      if (paused) return;
      const entry = JSON.parse(ev.data as string) as LogEntry;
      setEntries((prev) => [...prev.slice(-999), entry]);
    };

    return () => { es.close(); };
  }, [levelFilter, moduleFilter, paused]);

  useEffect(() => {
    if (!paused) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [entries, paused]);

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex items-center gap-2">
        <Input
          placeholder="level (info/warn/error)"
          value={levelFilter}
          onChange={(e) => setLevelFilter(e.target.value)}
          className="w-40"
        />
        <Input
          placeholder="module filter"
          value={moduleFilter}
          onChange={(e) => setModuleFilter(e.target.value)}
          className="w-40"
        />
        <Button size="sm" variant="outline" onClick={() => setPaused((p) => !p)}>
          {paused ? 'Resume' : 'Pause'}
        </Button>
        <Button size="sm" variant="outline" onClick={() => setEntries([])}>
          Clear
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto rounded border bg-black p-2 font-mono text-xs">
        {entries.map((e, i) => (
          <div key={i} className={`whitespace-pre-wrap py-0.5 ${LEVEL_COLORS[e.level] ?? 'text-gray-300'}`}>
            <span className="text-gray-500">{fmtTime(e.time)} </span>
            <span className="font-semibold uppercase">[{e.level}] </span>
            {e.module && <span className="text-purple-400">[{e.module}] </span>}
            <span>{e.msg}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
