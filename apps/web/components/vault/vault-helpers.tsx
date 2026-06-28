'use client';

import { useRef, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function ExportForm({ onDone }: { onDone: () => void }) {
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
      <p className="text-muted-foreground text-xs">
        All secrets will be encrypted with AES-256-GCM using the passphrase you choose.
      </p>
      <Input
        type="password"
        placeholder="Passphrase"
        value={passphrase}
        onChange={(e) => setPassphrase(e.target.value)}
      />
      {error && <p className="text-destructive text-sm">{error}</p>}
      <div className="flex gap-2">
        <Button size="sm" disabled={busy || !passphrase} onClick={() => void handleExport()}>
          {busy ? 'Exporting…' : 'Download backup'}
        </Button>
        <Button size="sm" variant="outline" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

export function ImportForm({ onDone }: { onDone: () => void }) {
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
      toast.success(`Imported ${data.imported} secret(s)`);
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
      <input
        ref={fileRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
      />
      <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
        {file ? file.name : 'Choose backup file…'}
      </Button>
      <Input
        type="password"
        placeholder="Passphrase"
        value={passphrase}
        onChange={(e) => setPassphrase(e.target.value)}
      />
      {error && <p className="text-destructive text-sm">{error}</p>}
      <div className="flex gap-2">
        <Button
          size="sm"
          disabled={busy || !file || !passphrase}
          onClick={() => void handleImport()}
        >
          {busy ? 'Importing…' : 'Import'}
        </Button>
        <Button size="sm" variant="outline" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
