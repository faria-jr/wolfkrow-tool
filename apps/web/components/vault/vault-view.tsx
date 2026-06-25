'use client';

import type { SecretMetadata } from '@wolfkrow/shared-types';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { listVaultSecrets } from '@/lib/api-client';

type Category = 'ai' | 'integration' | 'oauth' | 'other';

export function VaultView() {
  const { secrets, createSecret, deleteSecret, load } = useVault();
  const [showForm, setShowForm] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showImport, setShowImport] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded border bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200">
        Secrets stored in OS Keychain (macOS Keychain / Windows Credential Vault / Linux Secret Service). Values never reach the browser.
      </div>

      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={() => setShowExport(true)}>Export backup</Button>
        <Button size="sm" variant="outline" onClick={() => setShowImport(true)}>Import backup</Button>
      </div>

      {showExport && <ExportForm onDone={() => setShowExport(false)} />}
      {showImport && <ImportForm onDone={() => { setShowImport(false); void load(); }} />}

      <SecretTable secrets={secrets} onDelete={deleteSecret} />
      {showForm ? (
        <AddSecretForm onSave={createSecret} onDone={() => setShowForm(false)} onCancel={() => setShowForm(false)} />
      ) : (
        <Button onClick={() => setShowForm(true)} className="w-fit">Add Secret</Button>
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

  useEffect(() => { void load(); }, [load]);

  const createSecret = useCallback(async (input: { key: string; value: string; displayName: string; category: Category }) => {
    const res = await fetch('/api/vault', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const d = (await res.json()) as { error: string };
      throw new Error(d.error);
    }
    await load();
  }, [load]);

  const deleteSecret = useCallback(async (secretKey: string) => {
    await fetch(`/api/vault/${secretKey}`, { method: 'DELETE' });
    await load();
  }, [load]);

  return { secrets, createSecret, deleteSecret, load };
}

function ExportForm({ onDone }: { onDone: () => void }) {
  const [passphrase, setPassphrase] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleExport() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/vault/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passphrase }),
      });
      if (!res.ok) throw new Error(((await res.json()) as { error: string }).error);
      const data = (await res.json()) as { payload: unknown };
      const blob = new Blob([JSON.stringify(data.payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `wolfkrow-vault-backup-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded border p-4">
      <h3 className="font-semibold">Export encrypted backup</h3>
      <p className="text-xs text-muted-foreground">All secrets will be encrypted with AES-256-GCM using the passphrase you choose.</p>
      <Input type="password" placeholder="Passphrase" value={passphrase} onChange={(e) => setPassphrase(e.target.value)} />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button size="sm" disabled={busy || !passphrase} onClick={() => void handleExport()}>{busy ? 'Exporting…' : 'Download backup'}</Button>
        <Button size="sm" variant="outline" onClick={onDone}>Cancel</Button>
      </div>
    </div>
  );
}

function ImportForm({ onDone }: { onDone: () => void }) {
  const [passphrase, setPassphrase] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleImport() {
    if (!file || !passphrase) return;
    setBusy(true);
    setError(null);
    try {
      const text = await file.text();
      const payload = JSON.parse(text) as unknown;
      const res = await fetch('/api/vault/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passphrase, payload }),
      });
      if (!res.ok) throw new Error(((await res.json()) as { error: string }).error);
      const data = (await res.json()) as { imported: number };
      alert(`Imported ${data.imported} secret(s) successfully.`);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded border p-4">
      <h3 className="font-semibold">Import from backup</h3>
      <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
        {file ? file.name : 'Choose backup file…'}
      </Button>
      <Input type="password" placeholder="Passphrase" value={passphrase} onChange={(e) => setPassphrase(e.target.value)} />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button size="sm" disabled={busy || !file || !passphrase} onClick={() => void handleImport()}>{busy ? 'Importing…' : 'Import'}</Button>
        <Button size="sm" variant="outline" onClick={onDone}>Cancel</Button>
      </div>
    </div>
  );
}

function SecretTable({ secrets, onDelete }: { secrets: SecretMetadata[]; onDelete: (key: string) => void }) {
  return (
    <div className="rounded border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <th className="px-4 py-2">Name</th>
            <th className="px-4 py-2">Key</th>
            <th className="px-4 py-2">Category</th>
            <th className="px-4 py-2">Value</th>
            <th className="px-4 py-2"></th>
          </tr>
        </thead>
        <tbody className="px-4">
          {secrets.map((s) => (
            <tr key={s.key} className="border-b px-4 last:border-0">
              <td className="px-4 py-2 font-medium">{s.displayName}</td>
              <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{s.key}</td>
              <td className="px-4 py-2"><span className="rounded bg-secondary px-2 py-0.5 text-xs">{s.category}</span></td>
              <td className="px-4 py-2"><SecretValueCell secretKey={s.key} /></td>
              <td className="px-4 py-2">
                <Button size="sm" variant="destructive" onClick={() => {
                  if (confirm(`Delete secret "${s.key}"?`)) void onDelete(s.key);
                }}>Delete</Button>
              </td>
            </tr>
          ))}
          {secrets.length === 0 && (
            <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">No secrets stored</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function AddSecretForm({
  onSave,
  onDone,
  onCancel,
}: {
  onSave: (input: { key: string; value: string; displayName: string; category: Category }) => Promise<void>;
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
      <div className="grid grid-cols-2 gap-3">
        <Input placeholder="Key (e.g. anthropic-api-key)" value={key} onChange={(e) => setKey(e.target.value)} />
        <Input type="password" placeholder="Value" value={value} onChange={(e) => setValue(e.target.value)} />
        <Input placeholder="Display Name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        <CategorySelect value={category} onChange={setCategory} />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button onClick={() => void submit()} disabled={saving || !key || !value || !displayName}>{saving ? 'Saving…' : 'Save'}</Button>
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}

function CategorySelect({ value, onChange }: { value: Category; onChange: (v: Category) => void }) {
  return (
    <select className="rounded border px-3 py-2 text-sm" value={value} onChange={(e) => onChange(e.target.value as Category)}>
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
    <button onClick={() => void load()} className="text-xs text-blue-500 hover:underline">
      Show
    </button>
  );
}
