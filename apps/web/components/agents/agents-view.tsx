'use client';

import { Plus, RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

import type { AgentData } from './agent-form-modal';
import { AgentList } from './agent-list';
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

  return { duplicate, remove };
}

export function AgentsView() {
  const { agents, loading, error, loadAgents } = useAgents();
  const { duplicate, remove } = useAgentMutations(loadAgents);
  const router = useRouter();
  const [syncOpen, setSyncOpen] = useState(false);

  const openNew = useCallback(() => { router.push('/agents/new'); }, [router]);
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
      <SyncAgentsModal open={syncOpen} onClose={() => setSyncOpen(false)} onSynced={() => { void loadAgents(); }} agentCount={agents.length} />
    </div>
  );
}
