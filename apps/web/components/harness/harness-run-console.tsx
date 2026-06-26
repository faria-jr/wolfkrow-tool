'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { ExecutionView } from './execution-view';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { statusBadgeVariant } from '@/lib/status-badge';

interface ProjectData {
  id: string;
  name: string;
  description?: string;
  projectPath?: string;
  status: string;
}

interface SprintData {
  id: string;
  projectId: string;
  number: number;
  name: string;
  description?: string;
  status: string;
  features: Array<{ name: string; description: string; acceptanceCriteria: string[] }>;
}

interface RunData {
  project: ProjectData;
  sprints: SprintData[];
}

interface HarnessRunConsoleProps {
  projectId: string;
  sprintId?: string;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

function selectSprint(sprints: SprintData[], sprintId: string | undefined): SprintData | null {
  if (sprintId) return sprints.find((sprint) => sprint.id === sprintId) ?? null;
  return sprints[0] ?? null;
}

export function HarnessRunConsole({ projectId, sprintId }: HarnessRunConsoleProps) {
  const router = useRouter();
  const [data, setData] = useState<RunData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setError(null);
      try {
        const [project, sprints] = await Promise.all([
          fetchJson<ProjectData>(`/api/harness/projects/${projectId}`),
          fetchJson<SprintData[]>(`/api/harness/projects/${projectId}/sprints`),
        ]);
        if (!cancelled) setData({ project, sprints });
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load run');
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [projectId]);

  const sprint = useMemo(() => selectSprint(data?.sprints ?? [], sprintId), [data?.sprints, sprintId]);

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!data) return <p className="text-sm text-muted-foreground">Loading run console...</p>;
  if (!sprint) return <p className="text-sm text-muted-foreground">No sprint found for this project.</p>;

  return (
    <div className="flex min-h-full flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border bg-card p-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">{data.project.name}</h2>
            <Badge variant={statusBadgeVariant(data.project.status)}>{data.project.status}</Badge>
          </div>
          {data.project.description && (
            <p className="mt-1 text-sm text-muted-foreground">{data.project.description}</p>
          )}
          {data.project.projectPath && (
            <p className="mt-1 font-mono text-xs text-muted-foreground">Path: {data.project.projectPath}</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {data.sprints.map((item) => (
            <Badge key={item.id} variant={item.id === sprint.id ? 'default' : 'outline'}>
              Sprint {item.number}
            </Badge>
          ))}
        </div>
      </div>
      <ExecutionView
        projectId={projectId}
        sprintId={sprint.id}
        sprintName={sprint.name}
        features={sprint.features}
        onClose={() => router.push('/harness')}
      />
      <div className="flex justify-end">
        <Button variant="outline" onClick={() => router.push('/harness')}>Back to harness</Button>
      </div>
    </div>
  );
}
