'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { type PhaseCompleteData, PhaseStreamView } from './phase-stream-view';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface ProjectData {
  id: string;
  name: string;
  description?: string;
  currentStage: string;
  status: string;
  metrics: { totalTokens: number; phasesCompleted: number };
}

interface PhaseData {
  id: string;
  projectId: string;
  stage: string;
  status: string;
  metrics: { tokens: number; durationMs: number };
}

interface RunData {
  project: ProjectData;
  phases: PhaseData[];
  phase: PhaseData;
}

interface PipelineRunConsoleProps {
  projectId: string;
  stage?: string;
  phaseId?: string;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

function findPhase(phases: PhaseData[], phaseId: string | undefined, stage: string): PhaseData | null {
  if (phaseId) return phases.find((phase) => phase.id === phaseId) ?? null;
  return phases.find((phase) => phase.stage === stage) ?? null;
}

async function ensurePhase(projectId: string, phases: PhaseData[], phaseId: string | undefined, stage: string) {
  const existing = findPhase(phases, phaseId, stage);
  if (existing) return existing;
  return fetchJson<PhaseData>(`/api/pipeline/projects/${projectId}/phases`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stage }),
  });
}

interface PipelineRunHeaderProps {
  project: ProjectData;
  phases: PhaseData[];
  activePhaseId: string;
}

function PipelineRunHeader({ project, phases, activePhaseId }: PipelineRunHeaderProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border bg-card p-4">
      <div>
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">{project.name}</h2>
          <Badge variant="outline">{project.status}</Badge>
        </div>
        {project.description && (
          <p className="mt-1 text-sm text-muted-foreground">{project.description}</p>
        )}
        <p className="mt-1 text-sm text-muted-foreground">
          Tokens: {project.metrics.totalTokens} · Phases: {project.metrics.phasesCompleted}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {phases.map((item) => (
          <Badge key={item.id} variant={item.id === activePhaseId ? 'default' : 'outline'}>
            {item.stage}
          </Badge>
        ))}
      </div>
    </div>
  );
}

export function PipelineRunConsole({ projectId, stage, phaseId }: PipelineRunConsoleProps) {
  const router = useRouter();
  const [data, setData] = useState<RunData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setError(null);
      try {
        const [project, phases] = await Promise.all([
          fetchJson<ProjectData>(`/api/pipeline/projects/${projectId}`),
          fetchJson<PhaseData[]>(`/api/pipeline/projects/${projectId}/phases`),
        ]);
        const selectedStage = stage ?? project.currentStage;
        const phase = await ensurePhase(projectId, phases, phaseId, selectedStage);
        if (!cancelled) setData({ project, phases, phase });
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load pipeline run');
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [projectId, stage, phaseId]);

  const phases = useMemo(() => data?.phases ?? [], [data?.phases]);
  const handleComplete = useCallback((complete: PhaseCompleteData) => {
    if (!complete.phase && !complete.project) return;
    setData((prev) => {
      if (!prev) return prev;
      const nextProject = complete.project ? { ...prev.project, ...complete.project } : prev.project;
      const nextPhase = complete.phase ? { ...prev.phase, ...complete.phase } : prev.phase;
      return { ...prev, project: nextProject, phase: nextPhase };
    });
  }, []);

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!data) return <p className="text-sm text-muted-foreground">Loading pipeline run...</p>;

  return (
    <div className="flex min-h-full flex-col gap-4">
      <PipelineRunHeader project={data.project} phases={phases} activePhaseId={data.phase.id} />
      <PhaseStreamView
        projectId={projectId}
        phaseId={data.phase.id}
        stage={data.phase.stage}
        onComplete={handleComplete}
      />
      <div className="flex justify-end">
        <Button variant="outline" onClick={() => router.push('/pipeline')}>Back to pipeline</Button>
      </div>
    </div>
  );
}
