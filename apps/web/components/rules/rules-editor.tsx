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

export function RulesEditor() {
  const [rules, setRules] = useState<RuleProps[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [kind, setKind] = useState<RuleKind>('behavior');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch('/api/rules');
    if (res.ok) {
      const d = await res.json() as { rules: RuleProps[] };
      setRules(d.rules);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function handleCreate() {
    setSaving(true);
    await fetch('/api/rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, title, body }),
    });
    setShowForm(false);
    setTitle(''); setBody('');
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

  const grouped = Object.fromEntries(
    (['behavior', 'soul', 'user', 'custom'] as RuleKind[]).map((k) => [
      k,
      rules.filter((r) => r.kind === k),
    ]),
  );

  return (
    <div className="flex flex-col gap-6">
      {(['behavior', 'soul', 'user', 'custom'] as RuleKind[]).map((k) => (
        <div key={k}>
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {KIND_LABELS[k]}
          </h3>
          <div className="flex flex-col gap-2">
            {grouped[k]?.length === 0 && (
              <p className="text-sm text-muted-foreground">No {k} rules</p>
            )}
            {grouped[k]?.map((rule) => (
              <div key={rule.id} className={`rounded border p-3 ${rule.enabled ? '' : 'opacity-50'}`}>
                <div className="flex items-center justify-between">
                  <span className="font-medium">{rule.title}</span>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => void handleToggle(rule.id)}>
                      {rule.enabled ? 'Disable' : 'Enable'}
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => void handleDelete(rule.id)}>
                      Delete
                    </Button>
                  </div>
                </div>
                <pre className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground">{rule.body}</pre>
              </div>
            ))}
          </div>
        </div>
      ))}

      {showForm ? (
        <div className="flex flex-col gap-3 rounded border p-4">
          <h3 className="font-semibold">New Rule</h3>
          <div className="flex gap-3">
            <select
              className="rounded border px-3 py-2 text-sm"
              value={kind}
              onChange={(e) => setKind(e.target.value as RuleKind)}
            >
              {(['behavior', 'soul', 'user', 'custom'] as RuleKind[]).map((k) => (
                <option key={k} value={k}>{KIND_LABELS[k]}</option>
              ))}
            </select>
            <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} className="flex-1" />
          </div>
          <textarea
            className="h-32 rounded border px-3 py-2 text-sm font-mono"
            placeholder="Rule body (markdown supported)"
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <div className="flex gap-2">
            <Button onClick={() => void handleCreate()} disabled={saving || !title || !body}>
              {saving ? 'Saving…' : 'Create'}
            </Button>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </div>
      ) : (
        <Button onClick={() => setShowForm(true)} className="w-fit">Add Rule</Button>
      )}
    </div>
  );
}
