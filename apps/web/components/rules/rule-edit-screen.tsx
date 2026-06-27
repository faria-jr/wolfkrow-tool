'use client';

import { Loader2, Save } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { RULE_KIND_LABELS, RULE_KINDS, type RuleData, type RuleKind } from './rule-types';

import { MarkdownEditor } from '@/components/common/markdown-editor';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

interface RuleEditScreenProps { ruleId?: string; }

async function fetchRule(ruleId: string): Promise<RuleData> {
  const res = await fetch('/api/rules', { credentials: 'include' });
  if (!res.ok) throw new Error(`Failed to load rule (HTTP ${res.status})`);
  const rule = ((await res.json()) as { rules: RuleData[] }).rules.find((item) => item.id === ruleId);
  if (!rule) throw new Error('Rule not found');
  return rule;
}

async function saveRule(values: RuleFormState, ruleId: string | undefined): Promise<void> {
  const payload = ruleId
    ? { title: values.title, body: values.body, enabled: values.enabled }
    : values;
  const res = await fetch(ruleId ? `/api/rules/${ruleId}` : '/api/rules', {
    method: ruleId ? 'PATCH' : 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body: { error?: string } = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Save failed (HTTP ${res.status})`);
  }
}

interface RuleFormState {
  kind: RuleKind;
  title: string;
  body: string;
  enabled: boolean;
}

const DEFAULTS: RuleFormState = { kind: 'behavior', title: '', body: '', enabled: true };

function LoadingState() {
  return (
    <div className="flex items-center gap-2 text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
      Loading rule...
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <Alert variant="destructive">
      <AlertTitle>Could not load rule</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}

interface RuleFormFieldsProps {
  values: RuleFormState;
  kindLocked: boolean;
  update: <K extends keyof RuleFormState>(key: K, value: RuleFormState[K]) => void;
}

function RuleFormFields({ values, kindLocked, update }: RuleFormFieldsProps) {
  return (
    <>
      <div className="grid gap-4 md:grid-cols-[1fr_220px]">
        <div className="space-y-2">
          <Label htmlFor="rule-title">Title</Label>
          <Input id="rule-title" value={values.title} onChange={(event) => update('title', event.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Type</Label>
          <Select value={values.kind} onValueChange={(value) => update('kind', value as RuleKind)} disabled={kindLocked}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {RULE_KINDS.map((kind) => <SelectItem key={kind} value={kind}>{RULE_KIND_LABELS[kind]}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Switch id="rule-enabled" checked={values.enabled} onCheckedChange={(checked) => update('enabled', checked)} />
        <Label htmlFor="rule-enabled">Enabled</Label>
      </div>
      <MarkdownEditor value={values.body} onChange={(value) => update('body', value)} label="Rule body" />
    </>
  );
}

interface RuleFormActionsProps {
  saving: boolean;
  canSave: boolean;
  isEdit: boolean;
  onCancel: () => void;
  onSubmit: () => void;
}

function RuleFormActions({ saving, canSave, isEdit, onCancel, onSubmit }: RuleFormActionsProps) {
  return (
    <div className="flex justify-end gap-2">
      <Button variant="outline" onClick={onCancel} disabled={saving}>Cancel</Button>
      <Button onClick={onSubmit} disabled={saving || !canSave}>
        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
        {isEdit ? 'Save changes' : 'Create rule'}
      </Button>
    </div>
  );
}

function useRuleForm(ruleId: string | undefined) {
  const [values, setValues] = useState<RuleFormState>(DEFAULTS);
  const [loading, setLoading] = useState(Boolean(ruleId));
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!ruleId) return;
    let cancelled = false;
    void (async () => {
      try {
        const rule = await fetchRule(ruleId);
        if (!cancelled) setValues({ kind: rule.kind, title: rule.title, body: rule.body, enabled: rule.enabled });
      } catch (err) {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : 'Failed to load rule');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [ruleId]);
  const update: <K extends keyof RuleFormState>(key: K, value: RuleFormState[K]) => void =
    (key, value) => setValues((current) => ({ ...current, [key]: value }));
  return { values, loading, loadError, saving, setSaving, update };
}

async function submitRule(values: RuleFormState, ruleId: string | undefined, setSaving: (v: boolean) => void) {
  setSaving(true);
  try {
    await saveRule(values, ruleId);
    toast.success(ruleId ? 'Rule updated' : 'Rule created');
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Failed to save rule');
  } finally {
    setSaving(false);
  }
}

export function RuleEditScreen({ ruleId }: RuleEditScreenProps) {
  const router = useRouter();
  const { values, loading, loadError, saving, setSaving, update } = useRuleForm(ruleId);

  if (loading) return <LoadingState />;
  if (loadError) return <ErrorState message={loadError} />;

  return (
    <div className="space-y-5">
      <RuleFormFields values={values} kindLocked={Boolean(ruleId)} update={update} />
      <RuleFormActions
        saving={saving}
        canSave={Boolean(values.title.trim()) && Boolean(values.body.trim())}
        isEdit={Boolean(ruleId)}
        onCancel={() => router.push('/rules')}
        onSubmit={() => { void submitRule(values, ruleId, setSaving).then(() => router.push('/rules')); }}
      />
    </div>
  );
}
