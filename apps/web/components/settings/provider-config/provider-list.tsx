'use client';


import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BUILT_IN_PROVIDERS } from '@wolfkrow/domain/services';
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
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? 'Failed to save provider');
  }
}

async function deleteProvider(id: string): Promise<void> {
  const res = await fetch(`/api/providers/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete provider');
}

const BUILT_IN_IDS = new Set(BUILT_IN_PROVIDERS.map((p) => p.id));

export function ProviderList() {
  const qc = useQueryClient();
  const [modal, setModal] = useState<{ open: boolean; initial?: Partial<ProviderFormValues> }>({ open: false });
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

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
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['providers'] }); setConfirmDeleteId(null); },
  });

  if (isLoading) return <p className="text-muted-foreground text-sm">Loading providers…</p>;

  const confirmProvider = confirmDeleteId
    ? providers.find((p) => p.id === confirmDeleteId) ?? null
    : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button onClick={() => setModal({ open: true })}>Add provider</Button>
      </div>
      <ProviderMutationErrors saveError={saveMut.error} deleteError={deleteMut.error} />
      <ProviderGrid
        providers={providers}
        onEdit={(p) => setModal({ open: true, initial: { ...p, models: [...p.models] } })}
        onRequestDelete={(id) => setConfirmDeleteId(id)}
      />
      {confirmProvider && (
        <DeleteConfirmDialog
          providerId={confirmProvider.id}
          providerName={confirmProvider.displayName}
          isPending={deleteMut.isPending}
          onCancel={() => setConfirmDeleteId(null)}
          onConfirm={() => deleteMut.mutate(confirmProvider.id)}
        />
      )}
      <ProviderFormModal
        open={modal.open}
        {...(modal.initial !== undefined ? { initial: modal.initial } : {})}
        onSave={(values) => saveMut.mutate(values)}
        onClose={() => setModal({ open: false })}
      />
    </div>
  );
}

function ProviderMutationErrors({ saveError, deleteError }: { saveError: Error | null; deleteError: Error | null }) {
  if (!saveError && !deleteError) return null;
  return (
    <>
      {saveError && (
        <div className="rounded border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
          Save failed: {saveError.message}
        </div>
      )}
      {deleteError && (
        <div className="rounded border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
          Delete failed: {deleteError.message}
        </div>
      )}
    </>
  );
}

function ProviderGrid({
  providers,
  onEdit,
  onRequestDelete,
}: {
  providers: ProviderRow[];
  onEdit: (p: ProviderRow) => void;
  onRequestDelete: (id: string) => void;
}) {
  return (
    <div className="grid gap-3">
      {providers.map((p) => {
        const isBuiltIn = BUILT_IN_IDS.has(p.id);
        return (
          <ProviderCard
            key={p.id}
            provider={p}
            isBuiltIn={isBuiltIn}
            onEdit={() => onEdit(p)}
            {...(isBuiltIn ? {} : { onDelete: () => onRequestDelete(p.id) })}
          />
        );
      })}
    </div>
  );
}

function DeleteConfirmDialog({
  providerName,
  isPending,
  onCancel,
  onConfirm,
}: {
  providerId: string;
  providerName: string;
  isPending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80"
      role="dialog"
      aria-modal="true"
      aria-label="Confirm delete provider"
    >
      <div className="w-full max-w-sm rounded-lg border bg-background p-6 shadow-lg">
        <h2 className="text-lg font-semibold">Delete provider</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Are you sure you want to delete <strong>{providerName}</strong>? This cannot be undone.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel} disabled={isPending}>Cancel</Button>
          <Button variant="destructive" onClick={onConfirm} disabled={isPending}>
            {isPending ? 'Deleting…' : 'Delete'}
          </Button>
        </div>
      </div>
    </div>
  );
}
