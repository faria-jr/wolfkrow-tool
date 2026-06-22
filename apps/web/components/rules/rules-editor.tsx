'use client';

import { useCallback, useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type RuleKind = 'behavior' | 'soul' | 'user' | 'custom';

interface RuleProps {
  id: string;
  kind: RuleKind;
  title: string;
  body: string;
  enabled: boolean;
  sortOrder: number;
}

const KIND_LABELS: Record<RuleKind, string> = {
  behavior: 'Behavior',
  soul: 'Soul',
  user: 'User',
  custom: 'Custom',
};

const KINDS = ['behavior', 'soul', 'user', 'custom'] as RuleKind[];

interface RuleGroupProps { kind: RuleKind; rules: RuleProps[]; onToggle: (id: string) => void; onDelete: (id: string) => void; }
function RuleGroup({ kind, rules, onToggle, onDelete }: RuleGroupProps) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{KIND_LABELS[kind]}</h3>
      <div className="flex flex-col gap-2">
        {rules.length === 0 && <p className="text-sm text-muted-foreground">No {kind} rules</p>}
        {rules.map((rule) => (
          <div key={rule.id} className={`rounded border p-3 ${rule.enabled ? '' : 'opacity-50'}`}>
            <div className="flex items-center justify-between">
              <span className="font-medium">{rule.title}</span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => onToggle(rule.id)}>{rule.enabled ? 'Disable' : 'Enable'}</Button>
                <Button size="sm" variant="destructive" onClick={() => onDelete(rule.id)}>Delete</Button>
              </div>
            </div>
            <pre className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground">{rule.body}</pre>
          </div>
        ))}
      </div>
    </div>
  );
}

interface CreateFormProps { kind: RuleKind; setKind: (k: RuleKind) => void; title: string; setTitle: (t: string) => void; body: string; setBody: (b: string) => void; saving: boolean; onSubmit: () => void; onCancel: () => void; }
function RuleCreateForm({ kind, setKind, title, setTitle, body, setBody, saving, onSubmit, onCancel }: CreateFormProps) {
  return (
    <div className="flex flex-col gap-3 rounded border p-4">
      <h3 className="font-semibold">New Rule</h3>
      <div className="flex gap-3">
        <select className="rounded border px-3 py-2 text-sm" value={kind} onChange={(e) => setKind(e.target.value as RuleKind)}>
          {KINDS.map((k) => <option key={k} value={k}>{KIND_LABELS[k]}</option>)}
        </select>
        <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} className="flex-1" />
      </div>
      <textarea className="h-32 rounded border px-3 py-2 text-sm font-mono" placeholder="Rule body (markdown supported)" value={body} onChange={(e) => setBody(e.target.value)} />
      <div className="flex gap-2">
        <Button onClick={onSubmit} disabled={saving || !title || !body}>{saving ? 'Saving…' : 'Create'}</Button>
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}

export function RulesEditor() {
  const [rules, setRules] = useState<RuleProps[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [kind, setKind] = useState<RuleKind>('behavior');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch('/api/rules');
    if (res.ok) setRules(((await res.json()) as { rules: RuleProps[] }).rules);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function handleCreate() {
    setSaving(true);
    await fetch('/api/rules', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, title, body }) });
    setShowForm(false);
    setTitle('');
    setBody('');
    await load();
    setSaving(false);
  }

  async function handleToggle(id: string) {
    await fetch(`/api/rules/${id}/toggle`, { method: 'POST' });
    await load();
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this rule?')) return;
    await fetch(`/api/rules/${id}`, { method: 'DELETE' });
    await load();
  }

  const grouped = Object.fromEntries(KINDS.map((k) => [k, rules.filter((r) => r.kind === k)]));

  return (
    <div className="flex flex-col gap-6">
      {KINDS.map((k) => <RuleGroup key={k} kind={k} rules={grouped[k] ?? []} onToggle={(id) => void handleToggle(id)} onDelete={(id) => void handleDelete(id)} />)}
      {showForm ? (
        <RuleCreateForm kind={kind} setKind={setKind} title={title} setTitle={setTitle} body={body} setBody={setBody} saving={saving} onSubmit={() => void handleCreate()} onCancel={() => setShowForm(false)} />
      ) : (
        <Button onClick={() => setShowForm(true)} className="w-fit">Add Rule</Button>
      )}
    </div>
  );
}
