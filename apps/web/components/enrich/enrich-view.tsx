'use client';

import { useCallback, useEffect, useState } from 'react';

import { Input } from '@/components/ui/input';

interface EnrichSession {
  id: string;
  name: string;
  status: string;
  createdAt: string;
}

function statusBadge(status: string): string {
  const map: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    validated: 'bg-blue-100 text-blue-800',
    enriched: 'bg-green-100 text-green-800',
    failed: 'bg-red-100 text-red-800',
  };
  return map[status] ?? 'bg-gray-100 text-gray-600';
}

async function apiPost(url: string) {
  return fetch(url, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: '{}' });
}

interface CreateSessionFormProps {
  name: string;
  creating: boolean;
  onChange: (v: string) => void;
  onCreate: () => void;
}

function CreateSessionForm({ name, creating, onChange, onCreate }: CreateSessionFormProps) {
  return (
    <div className="bg-card flex gap-2 rounded-lg border p-4">
      <Input placeholder="Session name" value={name} onChange={(e) => onChange(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') onCreate(); }} className="flex-1" />
      <button onClick={onCreate} disabled={creating || !name.trim()} className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50">
        {creating ? 'Creating…' : 'Create'}
      </button>
    </div>
  );
}

interface SessionItemProps {
  session: EnrichSession;
  isActive: boolean;
  onValidate: () => void;
  onEnrich: () => void;
}

function SessionItem({ session: s, isActive, onValidate, onEnrich }: SessionItemProps) {
  return (
    <li className="bg-card flex items-center justify-between gap-4 rounded-lg border p-4">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">{s.name}</span>
          <span className={`rounded px-1.5 py-0.5 text-xs ${statusBadge(s.status)}`}>{s.status}</span>
        </div>
        <p className="text-muted-foreground text-xs">{new Date(s.createdAt).toLocaleString()}</p>
      </div>
      <div className="flex shrink-0 gap-2">
        <button onClick={onValidate} disabled={isActive} className="rounded border px-3 py-1 text-xs hover:bg-accent disabled:opacity-50">Validate</button>
        <button onClick={onEnrich} disabled={isActive} className="bg-primary text-primary-foreground rounded px-3 py-1 text-xs disabled:opacity-50">Enrich</button>
      </div>
    </li>
  );
}

interface SessionListProps {
  sessions: EnrichSession[];
  actionId: string | null;
  onAction: (id: string, endpoint: string) => void;
}

function SessionList({ sessions, actionId, onAction }: SessionListProps) {
  if (sessions.length === 0) return <p className="text-muted-foreground py-12 text-center text-sm">No enrich sessions yet.</p>;
  return (
    <ul className="space-y-3">
      {sessions.map((s) => (
        <SessionItem key={s.id} session={s} isActive={actionId === s.id} onValidate={() => onAction(s.id, 'validate')} onEnrich={() => onAction(s.id, 'enrich')} />
      ))}
    </ul>
  );
}

export function EnrichView() {
  const [sessions, setSessions] = useState<EnrichSession[]>([]);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch('/api/enrich/sessions', { credentials: 'include' });
    if (!res.ok) return;
    const data = await res.json() as { sessions?: EnrichSession[] } | EnrichSession[];
    setSessions(Array.isArray(data) ? data : (data.sessions ?? []));
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch('/api/enrich/sessions', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error('Failed to create session');
      setName('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setCreating(false);
    }
  };

  const handleAction = async (id: string, endpoint: string) => {
    setActionId(id);
    await apiPost(`/api/enrich/sessions/${id}/${endpoint}`);
    await load();
    setActionId(null);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Enrich</h1>
        <p className="text-muted-foreground text-sm">Validate and enrich knowledge sessions.</p>
      </div>
      <CreateSessionForm name={name} creating={creating} onChange={setName} onCreate={() => void handleCreate()} />
      {error && <p className="text-destructive text-sm">{error}</p>}
      <SessionList sessions={sessions} actionId={actionId} onAction={(id, ep) => void handleAction(id, ep)} />
    </div>
  );
}
