'use client';

import { Plus, RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

import type { AgentData } from './agent-form-modal';
import { AgentFormModal } from './agent-form-modal';
import { AgentList } from './agent-list';
import type { AgentFormValues } from './schema';
import { SyncAgentsModal } from './sync-agents-modal';

import { ErrorState } from '@/components/common/error-state';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

const API = '/api/agents';

async function apiFetch(path: string, opts?: RequestInit) {
  return fetch(path, { credentials: 'include', ...opts });
}

async function fetchAgents(): Promise<AgentData[]> {
  const res = await apiFetch(API);
  if (!res.ok) throw new Error('Failed to fetch agents');
  return ((await res.json()) as { agents: AgentData[] }).agents;
}

interface ViewActionsProps { onNew: () => void; onSync: () => void; }
function ViewActions({ onNew, onSync }: ViewActionsProps) {
  return (
    <div className="flex justify-end gap-2">
      <Button variant="outline" onClick={onSync}>
        <RefreshCw className="mr-2 h-4 w-4" />Sync to orchestrator
      </Button>
      <Button onClick={onNew}>
        <Plus className="mr-2 h-4 w-4" />New agent
      </Button>
    </div>
  );
}

function AgentListSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
    </div>
  );
}

function useAgents() {
  const [agents, setAgents] = useState<AgentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadAgents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setAgents(await fetchAgents());
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load agents'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadAgents(); }, [loadAgents]);
  return { agents, loading, error, loadAgents };
}

function useAgentMutations(loadAgents: () => Promise<void>) {
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  // EPIC 1.1 — the modal is now used for "new agent" only; editing happens in
  // the dedicated `/agents/[id]/edit` screen (see `AgentEditScreen`).
  const submit = useCallback(async (values: AgentFormValues) => {
    setSaving(true);
    try {
      const res = await apiFetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      toast.success('Agent created');
      setModalOpen(false);
      await loadAgents();
    } catch {
      toast.error('Failed to save agent');
    } finally { setSaving(false); }
  }, [loadAgents]);

  const duplicate = useCallback(async (agent: AgentData) => {
    if (!agent.id) return;
    try {
      const res = await apiFetch(`${API}/${agent.id}/duplicate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newName: `${agent.name} (copy)` }),
      });
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      toast.success('Agent duplicated');
      await loadAgents();
    } catch {
      toast.error('Failed to duplicate agent');
    }
  }, [loadAgents]);

  const remove = useCallback(async (id: string) => {
    try {
      const res = await apiFetch(`${API}/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      toast.success('Agent deleted');
      await loadAgents();
    } catch {
      toast.error('Failed to delete agent');
    }
  }, [loadAgents]);

  return { saving, modalOpen, setModalOpen, submit, duplicate, remove };
}

export function AgentsView() {
  const { agents, loading, error, loadAgents } = useAgents();
  const { saving, modalOpen, setModalOpen, submit, duplicate, remove } = useAgentMutations(loadAgents);
  const router = useRouter();
  const [syncOpen, setSyncOpen] = useState(false);

  const openNew = useCallback(() => { setModalOpen(true); }, [setModalOpen]);
  // EPIC 1.1 — edit now navigates to a dedicated full-screen route.
  const openEdit = useCallback((a: AgentData) => {
    if (!a.id) return;
    router.push(`/agents/${a.id}/edit`);
  }, [router]);

  return (
    <div className="space-y-4">
      <ViewActions onNew={openNew} onSync={() => setSyncOpen(true)} />
      {loading ? <AgentListSkeleton /> : error ? (
        <ErrorState
          title="Failed to load agents"
          description={error.message}
          onRetry={() => void loadAgents()}
        />
      ) : (
        <AgentList agents={agents} onEdit={openEdit} onDuplicate={duplicate} onDelete={remove} />
      )}
      <AgentFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={submit}
        loading={saving}
      />
      <SyncAgentsModal open={syncOpen} onClose={() => setSyncOpen(false)} onSynced={() => { void loadAgents(); }} agentCount={agents.length} />
    </div>
  );
}
