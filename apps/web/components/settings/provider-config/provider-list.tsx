'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { ProviderFormModal } from './provider-form-modal';
import type { ProviderFormValues } from './schema';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ProviderRow {
  id: string;
  displayName: string;
  protocol: 'anthropic-compat' | 'openai-compatible';
  baseUrl: string;
  apiKeyAccount: string;
  models: readonly string[];
  supportsTools: boolean;
}

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
        <h2 className="text-lg font-semibold">Providers</h2>
        <Button onClick={() => setModal({ open: true })}>Add provider</Button>
      </div>

      <div className="grid gap-3">
        {providers.map((p) => {
          const isBuiltIn = BUILT_IN_IDS.has(p.id);
          return (
            <Card key={p.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">{p.displayName}</CardTitle>
                    <p className="text-muted-foreground text-xs mt-0.5">{p.baseUrl}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{p.protocol}</Badge>
                    {isBuiltIn && <Badge variant="secondary">Built-in</Badge>}
                    {p.supportsTools && <Badge variant="secondary">Tools</Badge>}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center justify-between">
                  <div className="flex flex-wrap gap-1">
                    {p.models.slice(0, 3).map((m) => (
                      <span key={m} className="rounded bg-muted px-1.5 py-0.5 text-xs">{m}</span>
                    ))}
                    {p.models.length > 3 && (
                      <span className="rounded bg-muted px-1.5 py-0.5 text-xs">+{p.models.length - 3}</span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setModal({ open: true, initial: { ...p, models: [...p.models] } })}
                    >
                      {isBuiltIn ? 'Override' : 'Edit'}
                    </Button>
                    {!isBuiltIn && (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => deleteMut.mutate(p.id)}
                      >
                        Delete
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
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
