'use client';

import type { McpServerVisibility } from '@wolfkrow/domain';
import { Loader2, Save } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import type { McpServerData } from './mcp-server-list';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';

interface Props { serverId?: string; }

interface FormState {
  name: string;
  description: string;
  command: string;
  args: string;
  env: string;
  healthCheck: string;
  isActive: boolean;
  visibility: McpServerVisibility;
  isBuiltIn: boolean;
}

const DEFAULTS: FormState = {
  name: '',
  description: '',
  command: '',
  args: '',
  env: '',
  healthCheck: '',
  isActive: true,
  visibility: 'always',
  isBuiltIn: false,
};

async function fetchServer(serverId: string): Promise<McpServerData> {
  const res = await fetch('/api/mcp-servers', { credentials: 'include' });
  if (!res.ok) throw new Error(`Failed to load MCP server (HTTP ${res.status})`);
  const server = ((await res.json()) as { servers: McpServerData[] }).servers.find((item) => item.id === serverId);
  if (!server) throw new Error('MCP server not found');
  return server;
}

function envToText(env: Record<string, string>): string {
  return Object.entries(env).map(([key, value]) => `${key}=${value}`).join('\n');
}

function textToEnv(text: string): Record<string, string> {
  return Object.fromEntries(text.split('\n').map((line) => line.trim()).filter(Boolean).map((line) => {
    const idx = line.indexOf('=');
    return idx === -1 ? [line, ''] : [line.slice(0, idx), line.slice(idx + 1)];
  }));
}

function serverToForm(server: McpServerData): FormState {
  return {
    name: server.name,
    description: server.description ?? '',
    command: server.command,
    args: server.args.join('\n'),
    env: envToText(server.env),
    healthCheck: server.healthCheck ?? '',
    isActive: server.isActive,
    visibility: server.visibility,
    isBuiltIn: server.isBuiltIn,
  };
}

function toPayload(values: FormState, serverId: string | undefined): Record<string, unknown> {
  const base = {
    isActive: values.isActive,
    visibility: values.visibility,
  };
  if (values.isBuiltIn && serverId) return base;
  return {
    ...base,
    name: values.name,
    description: values.description,
    command: values.command,
    args: values.args.split('\n').map((arg) => arg.trim()).filter(Boolean),
    env: textToEnv(values.env),
    healthCheck: values.healthCheck,
  };
}

async function saveServer(values: FormState, serverId: string | undefined): Promise<void> {
  const res = await fetch(serverId ? `/api/mcp-servers/${serverId}` : '/api/mcp-servers', {
    method: serverId ? 'PATCH' : 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(toPayload(values, serverId)),
  });
  if (!res.ok) {
    const body: { error?: string } = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Save failed (HTTP ${res.status})`);
  }
}

function LoadingState() {
  return <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading server...</div>;
}

function ErrorState({ message }: { message: string }) {
  return <Alert variant="destructive"><AlertTitle>Could not load server</AlertTitle><AlertDescription>{message}</AlertDescription></Alert>;
}

export function McpServerEditScreen({ serverId }: Props) {
  const router = useRouter();
  const [values, setValues] = useState<FormState>(DEFAULTS);
  const [loading, setLoading] = useState(Boolean(serverId));
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!serverId) return;
    let cancelled = false;
    void (async () => {
      try {
        const server = await fetchServer(serverId);
        if (!cancelled) setValues(serverToForm(server));
      } catch (err) {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : 'Failed to load MCP server');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [serverId]);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => setValues((current) => ({ ...current, [key]: value }));
  const customDisabled = values.isBuiltIn && Boolean(serverId);

  const submit = async () => {
    setSaving(true);
    try {
      await saveServer(values, serverId);
      toast.success(serverId ? 'Server updated' : 'Server created');
      router.push('/mcp-servers');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save server');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingState />;
  if (loadError) return <ErrorState message={loadError} />;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2"><Label htmlFor="mcp-name">Name</Label><Input id="mcp-name" value={values.name} onChange={(event) => update('name', event.target.value)} disabled={customDisabled} /></div>
        <div className="space-y-2"><Label htmlFor="mcp-command">Command</Label><Input id="mcp-command" value={values.command} onChange={(event) => update('command', event.target.value)} disabled={customDisabled} /></div>
      </div>
      <div className="space-y-2"><Label htmlFor="mcp-description">Description</Label><Input id="mcp-description" value={values.description} onChange={(event) => update('description', event.target.value)} disabled={customDisabled} /></div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2"><Label htmlFor="mcp-args">Args</Label><Textarea id="mcp-args" value={values.args} onChange={(event) => update('args', event.target.value)} disabled={customDisabled} className="font-mono text-sm" /></div>
        <div className="space-y-2"><Label htmlFor="mcp-env">Env</Label><Textarea id="mcp-env" value={values.env} onChange={(event) => update('env', event.target.value)} disabled={customDisabled} className="font-mono text-sm" /></div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2"><Label htmlFor="mcp-health">Health check</Label><Input id="mcp-health" value={values.healthCheck} onChange={(event) => update('healthCheck', event.target.value)} disabled={customDisabled} /></div>
        <div className="space-y-2">
          <Label>Visibility</Label>
          <Select value={values.visibility} onValueChange={(value) => update('visibility', value as McpServerVisibility)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="always">always</SelectItem><SelectItem value="on-demand">on-demand</SelectItem><SelectItem value="background">background</SelectItem></SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex items-center gap-3"><Switch id="mcp-active" checked={values.isActive} onCheckedChange={(checked) => update('isActive', checked)} /><Label htmlFor="mcp-active">Active</Label></div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => router.push('/mcp-servers')} disabled={saving}>Cancel</Button>
        <Button onClick={() => void submit()} disabled={saving || !values.name.trim() || !values.command.trim()}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          {serverId ? 'Save changes' : 'Create server'}
        </Button>
      </div>
    </div>
  );
}
