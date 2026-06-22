'use client';

import { Plus } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

interface Props {
  onDone: () => void;
}

export function AddMcpServerModal({ onDone }: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [command, setCommand] = useState('');
  const [args, setArgs] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setName('');
    setCommand('');
    setArgs('');
    setError(null);
  }

  async function handleAdd() {
    if (!name.trim() || !command.trim()) { setError('Name and command are required.'); return; }
    setSaving(true);
    setError(null);
    try {
      const argsArray = args.trim() ? args.trim().split(/\s+/) : [];
      const res = await fetch('/api/mcp-servers', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, command, args: argsArray, isActive: true }),
      });
      if (!res.ok) {
        const d = (await res.json()) as { error?: string };
        throw new Error(d.error ?? 'Failed to add server');
      }
      reset();
      setOpen(false);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />Add server
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add MCP Server</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="mcp-name">Name</label>
            <Input
              id="mcp-name"
              placeholder="e.g. filesystem"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="mcp-command">Command</label>
            <Input
              id="mcp-command"
              placeholder="e.g. npx -y @modelcontextprotocol/server-filesystem"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              className="font-mono text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="mcp-args">Extra args (space-separated, optional)</label>
            <Input
              id="mcp-args"
              placeholder="e.g. /Users/me/docs"
              value={args}
              onChange={(e) => setArgs(e.target.value)}
              className="font-mono text-sm"
            />
          </div>
          {error && <p className="text-destructive text-sm">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => void handleAdd()} disabled={saving}>
              {saving ? 'Adding…' : 'Add'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
