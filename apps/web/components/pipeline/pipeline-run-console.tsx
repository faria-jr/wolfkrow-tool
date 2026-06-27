'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PhaseCompleteData, PhaseStreamView } from './phase-stream-view';
import {
  GitCommit,
  CheckCircle2,
  PlayCircle,
  HelpCircle,
  ArrowLeft,
  Cpu,
  Database,
  Terminal,
  FileText
} from 'lucide-react';

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

const STAGES = [
  { id: 'discovery', label: 'Discovery', desc: 'Requirements gather & PRD' },
  { id: 'spec_build', label: 'Spec Build', desc: 'Architecture Planning' },
  { id: 'spec_validate', label: 'Spec Validate', desc: 'Quality & DOD/DOR check' },
  { id: 'approval', label: 'Approval', desc: 'Manual or AI Gate approve' },
  { id: 'implementation', label: 'Implementation', desc: 'Epic planning & scaffolding' }
];

export function PipelineRunConsole({ projectId, stage, phaseId }: PipelineRunConsoleProps) {
  const router = useRouter();
  const [data, setData] = useState<RunData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedStage, setSelectedStage] = useState<string>('');

  const loadData = useCallback(async (stg?: string) => {
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
  }, [projectId, stage, phaseId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleComplete = useCallback((complete: PhaseCompleteData) => {
    if (!complete.phase && !complete.project) return;
    setData((prev) => {
      if (!prev) return prev;
      const nextProject = complete.project ? { ...prev.project, ...complete.project } : prev.project;
      const nextPhase = complete.phase ? { ...prev.phase, ...complete.phase } : prev.phase;
      
      // Update phases list with the new status
      const nextPhases = prev.phases.map((p) => 
        p.id === nextPhase.id ? { ...p, ...nextPhase } : p
      );
      
      return { ...prev, project: nextProject, phase: nextPhase, phases: nextPhases };
    });
  }, []);

  const handleSelectStage = async (newStage: string) => {
    if (newStage === selectedStage) return;
    setData(null);
    void loadData(newStage);
  };

  const phases = useMemo(() => data?.phases ?? [], [data?.phases]);

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-xs text-muted-foreground gap-2 font-mono">
        <LoaderSpinner />
        <span>Loading pipeline session...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 h-[calc(100vh-12rem)]">
      {/* Header Bar */}
      <div className="flex items-center justify-between px-4 py-3 rounded-lg border bg-card/40 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-zinc-200">{data.project.name}</h2>
            <Badge variant="outline" className="text-[10px] uppercase font-mono">
              {data.project.status}
            </Badge>
          </div>
          {data.project.description && (
            <p className="text-xs text-muted-foreground mt-0.5">{data.project.description}</p>
          )}
        </div>
        <div className="flex items-center gap-4 text-xs font-mono text-muted-foreground bg-zinc-950 px-3 py-1.5 rounded-lg border border-zinc-800">
          <span className="flex items-center gap-1"><Cpu className="h-3.5 w-3.5" /> Tokens: {data.project.metrics.totalTokens.toLocaleString()}</span>
          <span className="flex items-center gap-1"><Database className="h-3.5 w-3.5" /> Stages: {data.project.metrics.phasesCompleted}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1 min-h-0">
        {/* LEFT COLUMN: Vertical Timeline */}
        <Card className="lg:col-span-3 flex flex-col min-h-0 bg-zinc-950 border-zinc-800">
          <CardHeader className="pb-2 border-b border-zinc-800 shrink-0 bg-zinc-900/20">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-zinc-400">Timeline stages</CardTitle>
          </CardHeader>
          <ScrollArea className="flex-1 p-3">
            <div className="relative flex flex-col gap-6 pl-4 border-l border-zinc-800 mt-2">
              {STAGES.map((stg) => {
                const dbPhase = phases.find((p) => p.stage === stg.id);
                const isSelected = selectedStage === stg.id;
                const isCompleted = dbPhase?.status === 'completed' || dbPhase?.status === 'done';
                const isRunning = dbPhase?.status === 'running' || dbPhase?.status === 'starting';

                return (
                  <button
                    key={stg.id}
                    onClick={() => handleSelectStage(stg.id)}
                    className="relative w-full text-left flex flex-col gap-1 transition-all group focus:outline-none"
                  >
                    {/* Stepper Dot */}
                    <div className={`absolute -left-[23px] top-1 rounded-full p-0.5 border ${
                      isSelected
                        ? 'bg-blue-500 border-blue-400 text-white animate-pulse'
                        : isCompleted
                        ? 'bg-green-500 border-green-400 text-white'
                        : isRunning
                        ? 'bg-amber-500 border-amber-400 text-white animate-spin'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-600'
                    }`}>
                      {isCompleted ? (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      ) : isRunning ? (
                        <PlayCircle className="h-3.5 w-3.5" />
                      ) : (
                        <GitCommit className="h-3.5 w-3.5" />
                      )}
                    </div>

                    <span className={`text-xs font-semibold ${
                      isSelected
                        ? 'text-primary'
                        : isCompleted
                        ? 'text-zinc-200 group-hover:text-zinc-100'
                        : 'text-zinc-500 group-hover:text-zinc-400'
                    }`}>
                      {stg.label}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-normal line-clamp-1">{stg.desc}</span>
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        </Card>

        {/* RIGHT COLUMN: Stream log and Document Preview */}
        <Card className="lg:col-span-9 flex flex-col min-h-0 bg-zinc-950 border-zinc-800">
          <div className="flex-1 flex flex-col min-h-0">
            <PhaseStreamView
              projectId={projectId}
              phaseId={data.phase.id}
              stage={data.phase.stage}
              onComplete={handleComplete}
            />
          </div>
        </Card>
      </div>

      {/* Back navigation */}
      <div className="flex justify-end shrink-0 pt-2">
        <Button variant="outline" size="sm" onClick={() => router.push('/pipeline')} className="gap-1 text-xs">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to pipelines
        </Button>
      </div>
    </div>
  );
}

function LoaderSpinner() {
  return (
    <span className="relative flex h-4 w-4">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
      <span className="relative inline-flex rounded-full h-4 w-4 bg-blue-500" />
    </span>
  );
}
