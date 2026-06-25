'use client';

import { Plus, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';


import type { AgentData } from './agent-form-modal';
import { AgentFormModal } from './agent-form-modal';
import { AgentList } from './agent-list';
import type { AgentFormValues } from './schema';
import { SyncAgentsModal } from './sync-agents-modal';

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

  const loadAgents = useCallback(async () => {
    try { setAgents(await fetchAgents()); } catch { /* graceful */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void loadAgents(); }, [loadAgents]);
  return { agents, loading, loadAgents };
}

export function AgentsView() {
  const { agents, loading, loadAgents } = useAgents();
  const [modalOpen, setModalOpen] = useState(false);
  const [syncOpen, setSyncOpen] = useState(false);
  const [editing, setEditing] = useState<AgentData | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = useCallback(async (values: AgentFormValues) => {
    setSaving(true);
    try {
      const method = editing?.id ? 'PUT' : 'POST';
      const path = editing?.id ? `${API}/${editing.id}` : API;
      await apiFetch(path, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) });
      setModalOpen(false);
      await loadAgents();
    } finally { setSaving(false); }
  }, [editing, loadAgents]);

  const handleDuplicate = useCallback(async (agent: AgentData) => {
    if (!agent.id) return;
    await apiFetch(`${API}/${agent.id}/duplicate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newName: `${agent.name} (copy)` }),
    });
    await loadAgents();
  }, [loadAgents]);

  const handleDelete = useCallback(async (id: string) => {
    await apiFetch(`${API}/${id}`, { method: 'DELETE' });
    await loadAgents();
  }, [loadAgents]);

  const openNew = useCallback(() => { setEditing(null); setModalOpen(true); }, []);
  const openEdit = useCallback((a: AgentData) => { setEditing(a); setModalOpen(true); }, []);

  return (
    <div className="space-y-4">
      <ViewActions onNew={openNew} onSync={() => setSyncOpen(true)} />
      {loading ? <AgentListSkeleton /> : (
        <AgentList agents={agents} onEdit={openEdit} onDuplicate={handleDuplicate} onDelete={handleDelete} />
      )}
      <AgentFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
        {...(editing !== null ? { agent: editing } : {})}
        loading={saving}
      />
      <SyncAgentsModal open={syncOpen} onClose={() => setSyncOpen(false)} onSynced={() => { void loadAgents(); }} agentCount={agents.length} />
    </div>
  );
}
