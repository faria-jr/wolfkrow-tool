'use client';

import type { McpServerSource, McpServerVisibility } from '@wolfkrow/domain';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

import { AddMcpServerModal } from './add-mcp-server-modal';
import { GoogleOAuthPanel } from './google-oauth-panel';
import type { McpHealthSnapshot, McpServerData } from './mcp-server-list';
import { McpServerList } from './mcp-server-list';

import { ErrorState } from '@/components/common/error-state';
import { Skeleton } from '@/components/ui/skeleton';

const API = '/api/mcp-servers';
const CATALOG_API = '/api/mcp-servers/catalog';

interface CatalogIndex {
  builtIn: string[];
  planned: string[];
}

async function apiFetch(path: string, opts?: RequestInit): Promise<Response> {
  return fetch(path, { credentials: 'include', ...opts });
}

async function fetchCatalog(): Promise<CatalogIndex> {
  const res = await apiFetch(CATALOG_API);
  if (!res.ok) throw new Error('Failed to load MCP catalog');
  return (await res.json()) as CatalogIndex;
}

function deriveSource(name: string, catalog: CatalogIndex): McpServerSource {
  if (catalog.builtIn.includes(name)) return 'built-in';
  if (catalog.planned.includes(name)) return 'planned';
  return 'custom';
}

function applyHealthSnapshot(
  servers: McpServerData[],
  id: string,
  snapshot: McpHealthSnapshot,
): McpServerData[] {
  return servers.map((s) => (s.id === id ? { ...s, health: snapshot } : s));
}

interface ServerActions {
  toggle: (id: string, isActive: boolean) => Promise<void>;
  remove: (id: string) => Promise<void>;
  setVisibility: (id: string, visibility: McpServerVisibility) => Promise<void>;
  restart: (id: string) => Promise<void>;
  checkHealth: (id: string) => Promise<void>;
}

async function patchThenReload(
  id: string,
  body: unknown,
  reload: () => Promise<void>,
): Promise<Response> {
  const res = await apiFetch(`${API}/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  await reload();
  return res;
}

async function runWithToast(op: () => Promise<unknown>, ok: string, fail: string) {
  try {
    await op();
    toast.success(ok);
  } catch {
    toast.error(fail);
  }
}

async function removeServer(id: string, reload: () => Promise<void>) {
  const res = await apiFetch(`${API}/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('delete failed');
  await reload();
}

async function restartServer(id: string, reload: () => Promise<void>) {
  const res = await apiFetch(`${API}/${id}/restart`, { method: 'POST' });
  if (!res.ok) throw new Error('restart failed');
  await reload();
}

function useServerActions(
  reload: () => Promise<void>,
  setServers: (updater: (prev: McpServerData[]) => McpServerData[]) => void,
): ServerActions {
  const toggle = useCallback(
    (id: string, isActive: boolean) =>
      runWithToast(
        async () => patchThenReload(id, { isActive }, reload),
        `Server ${isActive ? 'enabled' : 'toggled'}`,
        'Failed to toggle server',
      ),
    [reload],
  );

  const remove = useCallback(
    (id: string) => runWithToast(async () => removeServer(id, reload), 'Server removed', 'Failed to remove server'),
    [reload],
  );

  const setVisibility = useCallback(
    (id: string, visibility: McpServerVisibility) =>
      runWithToast(
        async () => patchThenReload(id, { visibility }, reload),
        'Server visibility updated',
        'Failed to update visibility',
      ),
    [reload],
  );

  const restart = useCallback(
    (id: string) => runWithToast(async () => restartServer(id, reload), 'Server restarted', 'Failed to restart server'),
    [reload],
  );

  const checkHealth = useCallback(
    async (id: string) => {
      const res = await apiFetch(`${API}/${id}/health`);
      if (!res.ok) return;
      const body = (await res.json()) as Omit<McpHealthSnapshot, 'checkedAt'>;
      const snapshot: McpHealthSnapshot = { ...body, checkedAt: Date.now() };
      setServers((prev) => applyHealthSnapshot(prev, id, snapshot));
    },
    [setServers],
  );

  return { toggle, remove, setVisibility, restart, checkHealth };
}

function useMcpServers() {
  const [servers, setServers] = useState<McpServerData[]>([]);
  const [catalog, setCatalog] = useState<CatalogIndex>({ builtIn: [], planned: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const idx = catalog.builtIn.length || catalog.planned.length ? catalog : await fetchCatalog();
      if (!catalog.builtIn.length && idx.builtIn.length) setCatalog(idx);
      const res = await apiFetch(API);
      if (!res.ok) throw new Error('Failed to load MCP servers');
      const data = (await res.json()) as { servers: Array<Omit<McpServerData, 'source'>> };
      setServers(data.servers.map((s) => ({ ...s, source: deriveSource(s.name, idx) })));
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load MCP servers'));
    } finally { setLoading(false); }
  }, [catalog]);

  useEffect(() => { void reload(); }, [reload]);
  return { servers, loading, error, reload, setServers };
}

export function McpServersView() {
  const { servers, loading, error, reload, setServers } = useMcpServers();
  const actions = useServerActions(reload, setServers);
  const serverNames = servers.map((s) => s.name);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <AddMcpServerModal
          onDone={() => void reload()}
          onCreate={() => toast.success('Server created')}
        />
      </div>
      <GoogleOAuthPanel configuredServers={serverNames} />
      {loading ? (
        <div className="grid gap-3 md:grid-cols-2">
          <Skeleton className="h-32 w-full rounded-lg" />
          <Skeleton className="h-32 w-full rounded-lg" />
        </div>
      ) : error ? (
        <ErrorState
          title="Failed to load MCP servers"
          description={error.message}
          onRetry={() => void reload()}
        />
      ) : (
        <McpServerList
          servers={servers}
          onToggle={actions.toggle}
          onDelete={actions.remove}
          onRestart={actions.restart}
          onHealthCheck={actions.checkHealth}
          onVisibilityChange={actions.setVisibility}
        />
      )}
    </div>
  );
}
