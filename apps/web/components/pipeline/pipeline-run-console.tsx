'use client';

import { ArrowLeft, Cpu, Database } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { PhaseStreamView } from './phase-stream-view';
import type { PhaseCompleteData } from './phase-stream-view';
import { PipelineTimeline } from './pipeline-timeline';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

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

interface PipelineRunSessionArgs {
  phaseId: string | undefined;
  projectId: string;
  stage: string | undefined;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

function findPhase(
  phases: PhaseData[],
  phaseId: string | undefined,
  stage: string
): PhaseData | null {
  if (phaseId) return phases.find((phase) => phase.id === phaseId) ?? null;
  return phases.find((phase) => phase.stage === stage) ?? null;
}

async function ensurePhase(
  projectId: string,
  phases: PhaseData[],
  phaseId: string | undefined,
  stage: string
) {
  const existing = findPhase(phases, phaseId, stage);
  if (existing) return existing;
  return fetchJson<PhaseData>(`/api/pipeline/projects/${projectId}/phases`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stage }),
  });
}

export function PipelineRunConsole({ projectId, stage, phaseId }: PipelineRunConsoleProps) {
  const router = useRouter();
  const session = usePipelineRunSession({ phaseId, projectId, stage });

  if (session.error) return <p className="text-destructive text-sm">{session.error}</p>;
  if (!session.data) return <PipelineLoading />;

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <PipelineHeader project={session.data.project} />
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-12">
        <PipelineTimeline
          onSelectStage={session.selectStage}
          phases={session.phases}
          selectedStage={session.selectedStage}
        />
        <PipelineStreamCard
          data={session.data}
          handleComplete={session.handleComplete}
          projectId={projectId}
        />
      </div>
      <BackNavigation onBack={() => router.push('/pipeline')} />
    </div>
  );
}

function usePipelineRunSession({ phaseId, projectId, stage }: PipelineRunSessionArgs) {
  const [data, setData] = useState<RunData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedStage, setSelectedStage] = useState<string>('');

  const loadData = useCallback(
    async (stg?: string) => {
      try {
        const [project, phases] = await Promise.all([
          fetchJson<ProjectData>(`/api/pipeline/projects/${projectId}`),
          fetchJson<PhaseData[]>(`/api/pipeline/projects/${projectId}/phases`),
        ]);
        const targetStage = stg ?? stage ?? project.currentStage;
        const phase = await ensurePhase(projectId, phases, phaseId, targetStage);
        setData({ project, phases, phase });
        setSelectedStage(targetStage);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load pipeline run');
      }
    },
    [projectId, stage, phaseId]
  );

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleComplete = useCallback((complete: PhaseCompleteData) => {
    if (complete.phase || complete.project) {
      setData((prev) => applyPhaseCompletion(prev, complete));
    }
  }, []);

  const handleSelectStage = async (newStage: string) => {
    if (newStage === selectedStage) return;
    setData(null);
    void loadData(newStage);
  };

  const phases = useMemo(() => data?.phases ?? [], [data?.phases]);

  return { data, error, handleComplete, phases, selectedStage, selectStage: handleSelectStage };
}

function applyPhaseCompletion(prev: RunData | null, complete: PhaseCompleteData) {
  if (!prev) return prev;
  const nextProject = complete.project ? { ...prev.project, ...complete.project } : prev.project;
  const nextPhase = complete.phase ? { ...prev.phase, ...complete.phase } : prev.phase;
  const nextPhases = prev.phases.map((phase) =>
    phase.id === nextPhase.id ? { ...phase, ...nextPhase } : phase
  );
  return { ...prev, phase: nextPhase, phases: nextPhases, project: nextProject };
}

function PipelineLoading() {
  return (
    <div className="text-muted-foreground flex h-64 flex-col items-center justify-center gap-2 font-mono text-xs">
      <LoaderSpinner />
      <span>Loading pipeline session...</span>
    </div>
  );
}

function PipelineHeader({ project }: { project: ProjectData }) {
  return (
    <div className="bg-card/40 flex shrink-0 items-center justify-between rounded-lg border px-4 py-3">
      <div>
        <div className="flex items-center gap-2">
          <h2 className="text-base font-bold text-zinc-200">{project.name}</h2>
          <Badge variant="outline" className="font-mono text-xs uppercase">
            {project.status}
          </Badge>
        </div>
        {project.description && (
          <p className="text-muted-foreground mt-0.5 text-xs">{project.description}</p>
        )}
      </div>
      <PipelineMetrics project={project} />
    </div>
  );
}

function PipelineMetrics({ project }: { project: ProjectData }) {
  return (
    <div className="text-muted-foreground flex items-center gap-4 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-1.5 font-mono text-xs">
      <span className="flex items-center gap-1">
        <Cpu className="h-3.5 w-3.5" /> Tokens: {project.metrics.totalTokens.toLocaleString()}
      </span>
      <span className="flex items-center gap-1">
        <Database className="h-3.5 w-3.5" /> Stages: {project.metrics.phasesCompleted}
      </span>
    </div>
  );
}

function PipelineStreamCard({
  data,
  handleComplete,
  projectId,
}: {
  data: RunData;
  handleComplete: (complete: PhaseCompleteData) => void;
  projectId: string;
}) {
  return (
    <Card className="flex min-h-0 flex-col border-zinc-800 bg-zinc-950 lg:col-span-9">
      <div className="flex min-h-0 flex-1 flex-col">
        <PhaseStreamView
          onComplete={handleComplete}
          phaseId={data.phase.id}
          projectId={projectId}
          stage={data.phase.stage}
        />
      </div>
    </Card>
  );
}

function BackNavigation({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex shrink-0 justify-end pt-2">
      <Button className="gap-1 text-xs" onClick={onBack} size="sm" variant="outline">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to pipelines
      </Button>
    </div>
  );
}

function LoaderSpinner() {
  return (
    <span className="relative flex h-4 w-4">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
      <span className="relative inline-flex h-4 w-4 rounded-full bg-blue-500" />
    </span>
  );
}
