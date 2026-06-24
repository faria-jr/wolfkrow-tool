'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { ProviderCard, type ProviderRow } from './provider-card';
import { ProviderFormModal } from './provider-form-modal';
import type { ProviderFormValues } from './schema';

import { Button } from '@/components/ui/button';

async function fetchProviders(): Promise<ProviderRow[]> {
  const res = await fetch('/api/providers');
  if (!res.ok) throw new Error('Failed to load providers');
  return res.json() as Promise<ProviderRow[]>;
}

async function saveProvider(values: ProviderFormValues): Promise<void> {
  const res = await fetch('/api/providers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(values),
  });
  if (!res.ok) throw new Error('Failed to save provider');
}

async function deleteProvider(id: string): Promise<void> {
  const res = await fetch(`/api/providers/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete provider');
}

const BUILT_IN_IDS = new Set(['anthropic', 'zai', 'minimax', 'moonshot', 'qwen', 'openrouter', 'openai', 'ollama']);

export function ProviderList() {
  const qc = useQueryClient();
  const [modal, setModal] = useState<{ open: boolean; initial?: Partial<ProviderFormValues> }>({ open: false });

  const { data: providers = [], isLoading } = useQuery({
    queryKey: ['providers'],
    queryFn: fetchProviders,
  });

  const saveMut = useMutation({
    mutationFn: saveProvider,
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['providers'] }); setModal({ open: false }); },
  });

  const deleteMut = useMutation({
    mutationFn: deleteProvider,
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['providers'] }); },
  });

  if (isLoading) return <p className="text-muted-foreground text-sm">Loading providers…</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button onClick={() => setModal({ open: true })}>Add provider</Button>
      </div>

      <div className="grid gap-3">
        {providers.map((p) => (
          <ProviderCard
            key={p.id}
            provider={p}
            isBuiltIn={BUILT_IN_IDS.has(p.id)}
            onEdit={() => setModal({ open: true, initial: { ...p, models: [...p.models] } })}
            onDelete={() => deleteMut.mutate(p.id)}
          />
        ))}
      </div>

      <ProviderFormModal
        open={modal.open}
        {...(modal.initial !== undefined ? { initial: modal.initial } : {})}
        onSave={(values) => saveMut.mutate(values)}
        onClose={() => setModal({ open: false })}
      />
    </div>
  );
}
