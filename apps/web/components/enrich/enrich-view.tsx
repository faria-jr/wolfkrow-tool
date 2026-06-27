'use client';

import { useCallback, useEffect, useState } from 'react';

import { PageHeader } from '@/components/common/page-header';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

interface EnrichSession {
  id: string;
  name: string;
  status: string;
  createdAt: string;
}

interface SessionOutputs {
  validator?: string;
  enricher?: string;
}

function statusBadge(status: string): string {
  const map: Record<string, string> = {
    pending: 'bg-warning/15 text-warning',
    validated: 'bg-info/15 text-info',
    enriched: 'bg-success/15 text-success',
    failed: 'bg-destructive/15 text-destructive',
  };
  return map[status] ?? 'bg-muted text-muted-foreground';
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
  specContent: string;
  specExpanded: boolean;
  output: SessionOutputs | undefined;
  onToggleSpec: () => void;
  onSpecChange: (v: string) => void;
  onValidate: () => void;
  onEnrich: () => void;
}

function SessionOutputPanel({ output }: { output: SessionOutputs }) {
  if (!output.validator && !output.enricher) return null;
  return (
    <div className="border-t px-4 pb-4 pt-3 space-y-2">
      {output.validator && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-1">Validator output</p>
          <pre className="text-xs whitespace-pre-wrap rounded bg-muted p-2">{output.validator}</pre>
        </div>
      )}
      {output.enricher && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-1">Enricher output</p>
          <pre className="text-xs whitespace-pre-wrap rounded bg-muted p-2">{output.enricher}</pre>
        </div>
      )}
    </div>
  );
}

function SessionItem({ session: s, isActive, specContent, specExpanded, output, onToggleSpec, onSpecChange, onValidate, onEnrich }: SessionItemProps) {
  return (
    <li className="bg-card rounded-lg border">
      <div className="flex items-center justify-between gap-4 p-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium truncate">{s.name}</span>
            <span className={`rounded px-1.5 py-0.5 text-xs ${statusBadge(s.status)}`}>{s.status}</span>
          </div>
          <p className="text-muted-foreground text-xs">{new Date(s.createdAt).toLocaleString()}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button onClick={onToggleSpec} className="rounded border px-3 py-1 text-xs hover:bg-accent">Edit Spec</button>
          <button onClick={onValidate} disabled={isActive} className="rounded border px-3 py-1 text-xs hover:bg-accent disabled:opacity-50">Validate</button>
          <button onClick={onEnrich} disabled={isActive} className="bg-primary text-primary-foreground rounded px-3 py-1 text-xs disabled:opacity-50">Enrich</button>
        </div>
      </div>
      {specExpanded && (
        <div className="border-t px-4 pb-4 pt-3">
          <Textarea rows={6} placeholder="Paste your specification here..." value={specContent} onChange={(e) => onSpecChange(e.target.value)} className="w-full" />
        </div>
      )}
      {output && <SessionOutputPanel output={output} />}
    </li>
  );
}

interface SessionListProps {
  sessions: EnrichSession[];
  actionId: string | null;
  specContents: Record<string, string>;
  expandedSpec: string | null;
  outputs: Record<string, SessionOutputs>;
  onToggleSpec: (id: string) => void;
  onSpecChange: (id: string, v: string) => void;
  onAction: (id: string, endpoint: string) => void;
}

function SessionList({ sessions, actionId, specContents, expandedSpec, outputs, onToggleSpec, onSpecChange, onAction }: SessionListProps) {
  if (sessions.length === 0) return <p className="text-muted-foreground py-12 text-center text-sm">No enrich sessions yet.</p>;
  return (
    <ul className="space-y-3">
      {sessions.map((s) => (
        <SessionItem
          key={s.id}
          session={s}
          isActive={actionId === s.id}
          specContent={specContents[s.id] ?? ''}
          specExpanded={expandedSpec === s.id}
          output={outputs[s.id]}
          onToggleSpec={() => onToggleSpec(s.id)}
          onSpecChange={(v) => onSpecChange(s.id, v)}
          onValidate={() => onAction(s.id, 'validate')}
          onEnrich={() => onAction(s.id, 'enrich')}
        />
      ))}
    </ul>
  );
}

async function runEnrichAction(
  id: string,
  endpoint: string,
  specContents: Record<string, string>,
  setOutputs: React.Dispatch<React.SetStateAction<Record<string, SessionOutputs>>>,
): Promise<void> {
  const body: Record<string, string> = {};
  if (specContents[id]) body['specContent'] = specContents[id];
  const res = await fetch(`/api/enrich/sessions/${id}/${endpoint}`, {
    method: 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json() as Record<string, string>;
  setOutputs((prev) => {
    const current: SessionOutputs = prev[id] ?? {};
    if (endpoint === 'validate' && data['output'] !== undefined) return { ...prev, [id]: { ...current, validator: data['output'] } };
    if (endpoint === 'enrich' && data['enriched'] !== undefined) return { ...prev, [id]: { ...current, enricher: data['enriched'] } };
    return prev;
  });
}

export function EnrichView() {
  const [sessions, setSessions] = useState<EnrichSession[]>([]);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [specContents, setSpecContents] = useState<Record<string, string>>({});
  const [expandedSpec, setExpandedSpec] = useState<string | null>(null);
  const [outputs, setOutputs] = useState<Record<string, SessionOutputs>>({});

  const load = useCallback(async () => {
    const res = await fetch('/api/enrich/sessions', { credentials: 'include' });
    if (!res.ok) return;
    const data = await res.json() as { sessions?: EnrichSession[] } | EnrichSession[];
    setSessions(Array.isArray(data) ? data : (data.sessions ?? []));
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setCreating(true); setError(null);
    try {
      const res = await fetch('/api/enrich/sessions', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
      if (!res.ok) throw new Error('Failed to create session');
      setName(''); await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Error'); }
    finally { setCreating(false); }
  };

  const handleAction = async (id: string, endpoint: string) => {
    setActionId(id);
    await runEnrichAction(id, endpoint, specContents, setOutputs);
    await load();
    setActionId(null);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <PageHeader
        title="Enrich"
        description="Validate and enrich knowledge sessions."
      />
      <CreateSessionForm name={name} creating={creating} onChange={setName} onCreate={() => void handleCreate()} />
      {error && <p className="text-destructive text-sm">{error}</p>}
      <SessionList sessions={sessions} actionId={actionId} specContents={specContents} expandedSpec={expandedSpec} outputs={outputs}
        onToggleSpec={(id) => setExpandedSpec((prev) => (prev === id ? null : id))}
        onSpecChange={(id, v) => setSpecContents((prev) => ({ ...prev, [id]: v }))}
        onAction={(id, ep) => void handleAction(id, ep)} />
    </div>
  );
}
