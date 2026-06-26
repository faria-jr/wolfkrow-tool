'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Save } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { AgentFormBody } from './agent-form-body';
import type { AgentData } from './agent-form-modal';
import { agentDefaults, agentSchema } from './schema';
import type { AgentFormValues } from './schema';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';

interface Props { agentId: string; }

async function fetchAgent(agentId: string): Promise<AgentData> {
  const res = await fetch(`/api/agents/${agentId}`, { credentials: 'include' });
  if (!res.ok) {
    const body: { error?: string } = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Failed to load agent (HTTP ${res.status})`);
  }
  const { agent } = (await res.json()) as { agent: AgentData };
  return agent;
}

function agentToFormValues(agent: AgentData): AgentFormValues {
  return {
    name: agent.name,
    description: agent.description ?? '',
    model: agent.model,
    effort: agent.effort,
    thinking: agent.thinking,
    maxTurns: agent.maxTurns,
    allowedTools: agent.allowedTools,
    mcpServers: agent.mcpServers,
    isActive: agent.isActive,
    skills: agent.skills,
    runtime: agent.runtime,
    provider: agent.provider ?? '',
    systemPrompt: agent.systemPrompt ?? '',
    ...(agent.thinkingBudget !== undefined ? { thinkingBudget: agent.thinkingBudget } : {}),
    ...(agent.squad !== undefined ? { squad: agent.squad as AgentFormValues['squad'] } : {}),
  };
}

async function saveAgent(agentId: string, values: AgentFormValues): Promise<void> {
  const res = await fetch(`/api/agents/${agentId}`, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(values),
  });
  if (!res.ok) {
    const body: { error?: string } = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Save failed (HTTP ${res.status})`);
  }
}

function LoadingState() {
  return (
    <div className="flex items-center gap-2 text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
      Loading agent…
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <Alert variant="destructive">
      <AlertTitle>Could not load agent</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}

function EditActions({ saving, onCancel, onSubmit }: { saving: boolean; onCancel: () => void; onSubmit: () => void }) {
  return (
    <div className="flex justify-end gap-2 border-t border-border pt-4">
      <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>Cancel</Button>
      <Button type="submit" disabled={saving} onClick={onSubmit}>
        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
        {saving ? 'Saving…' : 'Save changes'}
      </Button>
    </div>
  );
}

/** EPIC 1.1 — dedicated edit screen for an agent. Replaces the legacy modal
 *  flow: `GET /api/agents/[id]` to load, `PUT /api/agents/[id]` to save, then
 *  redirect back to the list. The shared `AgentFormBody` keeps visual parity
 *  with the (still modal-based) "new agent" flow. */
export function AgentEditScreen({ agentId }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const form = useForm<AgentFormValues>({
    resolver: zodResolver(agentSchema),
    defaultValues: agentDefaults,
  });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const agent = await fetchAgent(agentId);
        if (!cancelled) form.reset(agentToFormValues(agent));
      } catch (err) {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : 'Failed to load agent');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [agentId, form]);

  const onSubmit = form.handleSubmit(async (values) => {
    setSaving(true);
    try {
      await saveAgent(agentId, values);
      toast.success('Agent updated');
      router.push('/agents');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save agent');
    } finally {
      setSaving(false);
    }
  });

  if (loading) return <LoadingState />;
  if (loadError) return <ErrorState message={loadError} />;

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} className="space-y-6">
        <AgentFormBody control={form.control} />
        <EditActions saving={saving} onCancel={() => router.push('/agents')} onSubmit={() => onSubmit()} />
      </form>
    </Form>
  );
}