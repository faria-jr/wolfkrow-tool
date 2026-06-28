'use client';

import type { SecretMetadata } from '@wolfkrow/shared-types';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

import { ExportForm, ImportForm } from './vault-helpers';

import { ConfirmDialog } from '@/components/chat/confirm-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { listVaultSecrets } from '@/lib/api-client';

type Category = 'ai' | 'integration' | 'oauth' | 'other';

export function VaultView() {
  const { secrets, createSecret, deleteSecret, load } = useVault();
  const [showForm, setShowForm] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showImport, setShowImport] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-warning/15 text-warning rounded border px-4 py-3 text-sm">
        Secrets stored in OS Keychain (macOS Keychain / Windows Credential Vault / Linux Secret
        Service). Values never reach the browser.
      </div>

      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={() => setShowExport(true)}>
          Export backup
        </Button>
        <Button size="sm" variant="outline" onClick={() => setShowImport(true)}>
          Import backup
        </Button>
      </div>

      {showExport && <ExportForm onDone={() => setShowExport(false)} />}
      {showImport && (
        <ImportForm
          onDone={() => {
            setShowImport(false);
            void load();
          }}
        />
      )}

      <SecretTable secrets={secrets} onDelete={deleteSecret} />
      {showForm ? (
        <AddSecretForm
          onSave={createSecret}
          onDone={() => setShowForm(false)}
          onCancel={() => setShowForm(false)}
        />
      ) : (
        <Button onClick={() => setShowForm(true)} className="w-fit">
          Add Secret
        </Button>
      )}
    </div>
  );
}

function useVault() {
  const [secrets, setSecrets] = useState<SecretMetadata[]>([]);

  const load = useCallback(async () => {
    try {
      setSecrets(await listVaultSecrets());
    } catch {
      setSecrets([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const createSecret = useCallback(
    async (input: { key: string; value: string; displayName: string; category: Category }) => {
      const res = await fetch('/api/vault', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const d = (await res.json()) as { error: string };
        toast.error('Failed to add secret');
        throw new Error(d.error);
      }
      toast.success('Secret added');
      await load();
    },
    [load]
  );

  const deleteSecret = useCallback(
    async (secretKey: string) => {
      const res = await fetch(`/api/vault/${secretKey}`, { method: 'DELETE' });
      if (!res.ok) {
        toast.error('Failed to delete secret');
        throw new Error('delete failed');
      }
      toast.success('Secret deleted');
      await load();
    },
    [load]
  );

  return { secrets, createSecret, deleteSecret, load };
}

function SecretTable({
  secrets,
  onDelete,
}: {
  secrets: SecretMetadata[];
  onDelete: (key: string) => void | Promise<void>;
}) {
  return (
    <div className="rounded border">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/50 text-muted-foreground border-b text-left text-xs uppercase">
            <th className="px-4 py-2">Name</th>
            <th className="px-4 py-2">Key</th>
            <th className="px-4 py-2">Category</th>
            <th className="px-4 py-2">Value</th>
            <th className="px-4 py-2"></th>
          </tr>
        </thead>
        <tbody className="px-4">
          {secrets.map((s) => (
            <SecretRow key={s.key} secret={s} onDelete={onDelete} />
          ))}
          {secrets.length === 0 && (
            <tr>
              <td colSpan={5} className="text-muted-foreground px-4 py-6 text-center">
                No secrets stored
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function SecretRow({
  secret,
  onDelete,
}: {
  secret: SecretMetadata;
  onDelete: (key: string) => void | Promise<void>;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function confirmDeletion() {
    setDeleting(true);
    try {
      await onDelete(secret.key);
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  return (
    <tr className="border-b px-4 last:border-0">
      <td className="px-4 py-2 font-medium">{secret.displayName}</td>
      <td className="text-muted-foreground px-4 py-2 font-mono text-xs">{secret.key}</td>
      <td className="px-4 py-2">
        <span className="bg-secondary rounded px-2 py-0.5 text-xs">{secret.category}</span>
      </td>
      <td className="px-4 py-2">
        <SecretValueCell secretKey={secret.key} />
      </td>
      <td className="px-4 py-2">
        <Button
          size="sm"
          variant="destructive"
          disabled={deleting}
          onClick={() => setConfirmDelete(true)}
        >
          Delete
        </Button>
        <ConfirmDialog
          open={confirmDelete}
          title="Delete secret"
          description={`Delete secret "${secret.key}"? This cannot be undone.`}
          confirmLabel="Delete"
          onConfirm={() => void confirmDeletion()}
          onCancel={() => setConfirmDelete(false)}
        />
      </td>
    </tr>
  );
}

function AddSecretForm({
  onSave,
  onDone,
  onCancel,
}: {
  onSave: (input: {
    key: string;
    value: string;
    displayName: string;
    category: Category;
  }) => Promise<void>;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [key, setKey] = useState('');
  const [value, setValue] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [category, setCategory] = useState<Category>('ai');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      await onSave({ key, value, displayName, category });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded border p-4">
      <h3 className="font-semibold">Add Secret</h3>
      <SecretFields
        key={key}
        value={value}
        displayName={displayName}
        onKey={setKey}
        onValue={setValue}
        onDisplayName={setDisplayName}
      />
      <CategorySelect value={category} onChange={setCategory} />
      {error && <p className="text-destructive text-sm">{error}</p>}
      <div className="flex gap-2">
        <Button onClick={() => void submit()} disabled={saving || !key || !value || !displayName}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

interface SecretFieldsProps {
  key: string;
  value: string;
  displayName: string;
  onKey: (v: string) => void;
  onValue: (v: string) => void;
  onDisplayName: (v: string) => void;
}

function SecretFields({
  key: k,
  value,
  displayName,
  onKey,
  onValue,
  onDisplayName,
}: SecretFieldsProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="flex flex-col gap-1">
        <Label htmlFor="vault-key">Key</Label>
        <Input
          id="vault-key"
          placeholder="e.g. anthropic-api-key"
          value={k}
          onChange={(e) => onKey(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="vault-value">Value</Label>
        <Input
          id="vault-value"
          type="password"
          placeholder="Secret value"
          value={value}
          onChange={(e) => onValue(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="vault-display">Display name</Label>
        <Input
          id="vault-display"
          placeholder="Display Name"
          value={displayName}
          onChange={(e) => onDisplayName(e.target.value)}
        />
      </div>
    </div>
  );
}

function CategorySelect({ value, onChange }: { value: Category; onChange: (v: Category) => void }) {
  return (
    <select
      className="rounded border px-3 py-2 text-sm"
      value={value}
      onChange={(e) => onChange(e.target.value as Category)}
    >
      <option value="ai">AI</option>
      <option value="integration">Integration</option>
      <option value="oauth">OAuth</option>
      <option value="other">Other</option>
    </select>
  );
}

function SecretValueCell({ secretKey }: { secretKey: string }) {
  const [masked, setMasked] = useState<string | null>(null);

  async function load() {
    const res = await fetch(`/api/vault/${secretKey}/masked`);
    if (res.ok) {
      const d = (await res.json()) as { masked: string };
      setMasked(d.masked);
    }
  }

  if (masked) return <span className="font-mono text-xs">{masked}</span>;
  return (
    <button onClick={() => void load()} className="text-info text-xs hover:underline">
      Show
    </button>
  );
}
