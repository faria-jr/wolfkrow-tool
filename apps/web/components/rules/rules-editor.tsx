'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/chat/confirm-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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

interface RuleGroupProps { kind: RuleKind; rules: RuleProps[]; onToggle: (id: string) => void; deletingId: string | null; onRequestDelete: (id: string) => void; }
function RuleGroup({ kind, rules, onToggle, deletingId, onRequestDelete }: RuleGroupProps) {
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
                <Button size="sm" variant="destructive" disabled={deletingId === rule.id} onClick={() => onRequestDelete(rule.id)}>Delete</Button>
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
        <div className="flex flex-col gap-1">
          <Label htmlFor="rule-kind">Kind</Label>
          <select id="rule-kind" className="rounded border px-3 py-2 text-sm" value={kind} onChange={(e) => setKind(e.target.value as RuleKind)}>
            {KINDS.map((k) => <option key={k} value={k}>{KIND_LABELS[k]}</option>)}
          </select>
        </div>
        <div className="flex flex-1 flex-col gap-1">
          <Label htmlFor="rule-title">Title</Label>
          <Input id="rule-title" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} className="flex-1" />
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="rule-body">Body</Label>
        <textarea id="rule-body" className="h-32 rounded border px-3 py-2 text-sm font-mono" placeholder="Rule body (markdown supported)" value={body} onChange={(e) => setBody(e.target.value)} />
      </div>
      <div className="flex gap-2">
        <Button onClick={onSubmit} disabled={saving || !title || !body}>{saving ? 'Saving…' : 'Create'}</Button>
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}

interface CreateRuleParams {
  kind: RuleKind;
  title: string;
  body: string;
  setSaving: (b: boolean) => void;
  setShowForm: (b: boolean) => void;
  setTitle: (t: string) => void;
  setBody: (b: string) => void;
  load: () => Promise<void>;
}
async function doCreateRule(p: CreateRuleParams) {
  p.setSaving(true);
  try {
    const res = await fetch('/api/rules', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: p.kind, title: p.title, body: p.body }) });
    if (!res.ok) {
      const d = (await res.json().catch(() => null)) as { error?: string } | null;
      toast.error(d?.error ?? 'Failed to create rule');
      return;
    }
    toast.success('Rule created');
    p.setShowForm(false);
    p.setTitle('');
    p.setBody('');
    await p.load();
  } catch {
    toast.error('Failed to create rule');
  } finally {
    p.setSaving(false);
  }
}

async function doToggleRule(id: string, load: () => Promise<void>) {
  try {
    const res = await fetch(`/api/rules/${id}/toggle`, { method: 'POST' });
    if (!res.ok) { toast.error('Failed to toggle rule'); return; }
    toast.success('Rule toggled');
    await load();
  } catch {
    toast.error('Failed to toggle rule');
  }
}

interface DeleteRuleParams { id: string; load: () => Promise<void>; setDeletingId: (id: string | null) => void; clearPending: () => void; }
async function doDeleteRule(p: DeleteRuleParams) {
  p.setDeletingId(p.id);
  p.clearPending();
  try {
    const res = await fetch(`/api/rules/${p.id}`, { method: 'DELETE' });
    if (!res.ok) { toast.error('Failed to delete rule'); return; }
    toast.success('Rule deleted');
    await p.load();
  } catch {
    toast.error('Failed to delete rule');
  } finally {
    p.setDeletingId(null);
  }
}

interface RulesActions {
  rules: RuleProps[];
  showForm: boolean;
  setShowForm: (b: boolean) => void;
  kind: RuleKind;
  setKind: (k: RuleKind) => void;
  title: string;
  setTitle: (t: string) => void;
  body: string;
  setBody: (b: string) => void;
  saving: boolean;
  deletingId: string | null;
  pendingDeleteId: string | null;
  handleCreate: () => Promise<void>;
  handleToggle: (id: string) => Promise<void>;
  performDelete: (id: string) => Promise<void>;
  requestDelete: (id: string) => void;
  cancelDelete: () => void;
}
function useRulesActions(): RulesActions {
  const [rules, setRules] = useState<RuleProps[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [kind, setKind] = useState<RuleKind>('behavior');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch('/api/rules');
    if (res.ok) setRules(((await res.json()) as { rules: RuleProps[] }).rules);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleCreate = useCallback(() => doCreateRule({ kind, title, body, setSaving, setShowForm, setTitle, setBody, load }), [body, kind, load, setBody, setSaving, setShowForm, setTitle, title]);
  const handleToggle = useCallback((id: string) => doToggleRule(id, load), [load]);
  const performDelete = useCallback((id: string) => doDeleteRule({ id, load, setDeletingId, clearPending: () => setPendingDeleteId(null) }), [load]);

  return {
    rules, showForm, setShowForm, kind, setKind, title, setTitle, body, setBody,
    saving, deletingId, pendingDeleteId,
    handleCreate, handleToggle, performDelete,
    requestDelete: setPendingDeleteId,
    cancelDelete: () => setPendingDeleteId(null),
  };
}

export function RulesEditor() {
  const a = useRulesActions();
  const grouped = Object.fromEntries(KINDS.map((k) => [k, a.rules.filter((r) => r.kind === k)]));

  return (
    <div className="flex flex-col gap-6">
      {KINDS.map((k) => <RuleGroup key={k} kind={k} rules={grouped[k] ?? []} onToggle={(id) => void a.handleToggle(id)} deletingId={a.deletingId} onRequestDelete={a.requestDelete} />)}
      {a.showForm ? (
        <RuleCreateForm kind={a.kind} setKind={a.setKind} title={a.title} setTitle={a.setTitle} body={a.body} setBody={a.setBody} saving={a.saving} onSubmit={() => void a.handleCreate()} onCancel={() => a.setShowForm(false)} />
      ) : (
        <Button onClick={() => a.setShowForm(true)} className="w-fit">Add Rule</Button>
      )}
      <ConfirmDialog
        open={a.pendingDeleteId !== null}
        title="Delete rule"
        description="Delete this rule? This cannot be undone."
        confirmLabel="Delete"
        onConfirm={() => a.pendingDeleteId && void a.performDelete(a.pendingDeleteId)}
        onCancel={a.cancelDelete}
      />
    </div>
  );
}
