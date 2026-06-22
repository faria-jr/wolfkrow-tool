'use client';

import { useCallback, useEffect, useState } from 'react';

import { AddMcpServerModal } from './add-mcp-server-modal';
import type { McpServerData } from './mcp-server-list';
import { McpServerList } from './mcp-server-list';

const API = '/api/mcp-servers';

async function apiFetch(path: string, opts?: RequestInit) {
  return fetch(path, { credentials: 'include', ...opts });
}

async function fetchServers(): Promise<McpServerData[]> {
  const res = await apiFetch(API);
  if (!res.ok) throw new Error('Failed to fetch MCP servers');
  return ((await res.json()) as { servers: McpServerData[] }).servers;
}

export function McpServersView() {
  const [servers, setServers] = useState<McpServerData[]>([]);

  const load = useCallback(async () => {
    try { setServers(await fetchServers()); } catch { /* graceful */ }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleToggle = useCallback(async (id: string, isActive: boolean) => {
    await apiFetch(`${API}/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive }),
    });
    await load();
  }, [load]);

  const handleDelete = useCallback(async (id: string) => {
    await apiFetch(`${API}/${id}`, { method: 'DELETE' });
    await load();
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <AddMcpServerModal onDone={() => void load()} />
      </div>
      <McpServerList servers={servers} onToggle={handleToggle} onDelete={handleDelete} />
    </div>
  );
}
