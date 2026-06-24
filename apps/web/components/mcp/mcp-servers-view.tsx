'use client';

import type { McpServerSource, McpServerVisibility } from '@wolfkrow/domain';
import { useCallback, useEffect, useState } from 'react';


import { AddMcpServerModal } from './add-mcp-server-modal';
import type { McpHealthSnapshot, McpServerData } from './mcp-server-list';
import { McpServerList } from './mcp-server-list';

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
  try {
    const res = await apiFetch(CATALOG_API);
    if (!res.ok) return { builtIn: [], planned: [] };
    return (await res.json()) as CatalogIndex;
  } catch {
    return { builtIn: [], planned: [] };
  }
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

function patchThenReload(id: string, body: unknown, reload: () => Promise<void>) {
  return async (): Promise<void> => {
    await apiFetch(`${API}/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    await reload();
  };
}

function useServerActions(
  reload: () => Promise<void>,
  setServers: (updater: (prev: McpServerData[]) => McpServerData[]) => void,
): ServerActions {
  const toggle = useCallback(
    async (id: string, isActive: boolean) => {
      await patchThenReload(id, { isActive }, reload)();
    },
    [reload],
  );

  const remove = useCallback(
    async (id: string) => {
      await apiFetch(`${API}/${id}`, { method: 'DELETE' });
      await reload();
    },
    [reload],
  );

  const setVisibility = useCallback(
    async (id: string, visibility: McpServerVisibility) => {
      await patchThenReload(id, { visibility }, reload)();
    },
    [reload],
  );

  const restart = useCallback(
    async (id: string) => {
      await apiFetch(`${API}/${id}/restart`, { method: 'POST' });
      await reload();
    },
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

export function McpServersView() {
  const [servers, setServers] = useState<McpServerData[]>([]);
  const [catalog, setCatalog] = useState<CatalogIndex>({ builtIn: [], planned: [] });

  const reload = useCallback(async () => {
    try {
      const idx =
        catalog.builtIn.length || catalog.planned.length ? catalog : await fetchCatalog();
      if (!catalog.builtIn.length && idx.builtIn.length) setCatalog(idx);
      const res = await apiFetch(API);
      if (!res.ok) return;
      const data = (await res.json()) as { servers: Array<Omit<McpServerData, 'source'>> };
      setServers(data.servers.map((s) => ({ ...s, source: deriveSource(s.name, idx) })));
    } catch {
      /* graceful */
    }
  }, [catalog]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const actions = useServerActions(reload, setServers);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <AddMcpServerModal onDone={() => void reload()} />
      </div>
      <McpServerList
        servers={servers}
        onToggle={actions.toggle}
        onDelete={actions.remove}
        onRestart={actions.restart}
        onHealthCheck={actions.checkHealth}
        onVisibilityChange={actions.setVisibility}
      />
    </div>
  );
}
