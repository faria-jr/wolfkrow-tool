'use client';

import { Plus } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import type { AgentData } from './agent-form-modal';
import { AgentFormModal } from './agent-form-modal';
import { AgentList } from './agent-list';
import type { AgentFormValues } from './schema';

import { Button } from '@/components/ui/button';

const API = '/api/agents';

async function apiFetch(path: string, opts?: RequestInit) {
  return fetch(path, { credentials: 'include', ...opts });
}

async function fetchAgents(): Promise<AgentData[]> {
  const res = await apiFetch(API);
  if (!res.ok) throw new Error('Failed to fetch agents');
  return ((await res.json()) as { agents: AgentData[] }).agents;
}

export function AgentsView() {
  const [agents, setAgents] = useState<AgentData[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AgentData | null>(null);
  const [saving, setSaving] = useState(false);

  const loadAgents = useCallback(async () => {
    try { setAgents(await fetchAgents()); } catch { /* graceful */ }
  }, []);

  useEffect(() => { void loadAgents(); }, [loadAgents]);

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

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => { setEditing(null); setModalOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" />New agent
        </Button>
      </div>
      <AgentList agents={agents} onEdit={(a) => { setEditing(a); setModalOpen(true); }} onDuplicate={handleDuplicate} onDelete={handleDelete} />
      <AgentFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
        {...(editing !== null ? { agent: editing } : {})}
        loading={saving}
      />
    </div>
  );
}
