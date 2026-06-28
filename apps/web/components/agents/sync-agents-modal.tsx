'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Runtime = 'cloud' | 'local' | 'codex' | 'external' | 'claude-compat';

interface RuntimeSelectorProps {
  value: Runtime;
  onChange: (v: Runtime) => void;
}
function RuntimeSelector({ value, onChange }: RuntimeSelectorProps) {
  return (
    <div className="space-y-1">
      <Label htmlFor="sync-runtime">Target Runtime</Label>
      <Select value={value} onValueChange={(v) => onChange(v as Runtime)}>
        <SelectTrigger id="sync-runtime">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="cloud">Cloud (Anthropic API)</SelectItem>
          <SelectItem value="local">Local (Ollama)</SelectItem>
          <SelectItem value="codex">Codex (OpenAI)</SelectItem>
          <SelectItem value="external">External</SelectItem>
          <SelectItem value="claude-compat">
            Claude-compat (Z.ai, MiniMax, Moonshot, Qwen)
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSynced: () => void;
  agentCount: number;
}

export function SyncAgentsModal({ open, onClose, onSynced, agentCount }: Props) {
  const [runtime, setRuntime] = useState<Runtime>('cloud');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<number | null>(null);

  const handleSync = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/agents/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ targetRuntime: runtime, targetModel: undefined }),
      });
      const data = (await res.json()) as { synced: number };
      setResult(data.synced);
      onSynced();
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = (v: boolean) => {
    if (!v) {
      setResult(null);
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Sync Agents to Orchestrator</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-muted-foreground text-sm">
            Update all {agentCount} agent(s) to the selected runtime.
          </p>
          <RuntimeSelector value={runtime} onChange={setRuntime} />
          {result !== null && (
            <p className="text-success text-sm font-medium">{result} agent(s) updated.</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSync} disabled={loading}>
            {loading ? 'Syncing…' : 'Sync all agents'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
