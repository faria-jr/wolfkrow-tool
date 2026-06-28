'use client';

import { useQuery } from '@tanstack/react-query';

async function fetchCount(url: string): Promise<number> {
  try {
    const res = await fetch(url, { credentials: 'include' });
    if (!res.ok) return 0;
    const data = (await res.json()) as unknown;
    if (Array.isArray(data)) return data.length;
    return 0;
  } catch {
    return 0;
  }
}

export function useSidebarCounts() {
  const { data: agents = 0 } = useQuery({
    queryKey: ['sidebar-count', 'agents'],
    queryFn: () => fetchCount('/api/agents'),
    staleTime: 60_000,
  });

  const { data: skills = 0 } = useQuery({
    queryKey: ['sidebar-count', 'skills'],
    queryFn: () => fetchCount('/api/skills'),
    staleTime: 60_000,
  });

  const { data: mcp = 0 } = useQuery({
    queryKey: ['sidebar-count', 'mcp'],
    queryFn: () => fetchCount('/api/mcp-servers'),
    staleTime: 60_000,
  });

  return { agents, skills, mcp } as Record<string, number>;
}
