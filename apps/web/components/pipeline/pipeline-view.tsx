'use client';

import type React from 'react';
import { useCallback, useEffect, useState } from 'react';

import { PhaseStreamView } from './phase-stream-view';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface ProjectData {
  id: string;
  userId: string;
  name: string;
  description?: string;
  currentStage: string;
  status: string;
  discoveryNotes?: string;
  specPath?: string;
  prdPath?: string;
  approvalNotes?: string;
  metrics: { totalTokens: number; phasesCompleted: number };
  createdAt: string;
}

interface PhaseData {
  id: string;
  projectId: string;
  stage: string;
  status: string;
  artifactPath?: string;
  startedAt?: string;
  completedAt?: string;
  metrics: { tokens: number; durationMs: number };
}

const STAGE_ORDER = ['discovery', 'spec_build', 'spec_validate', 'approval', 'implementation', 'completed'];
const STAGE_LABEL: Record<string, string> = {
  discovery: 'Discovery', spec_build: 'Spec Build', spec_validate: 'Spec Validate',
  approval: 'Approval', implementation: 'Implementation', completed: 'Completed',
};
const STAGES = STAGE_ORDER.filter((s) => s !== 'completed');

function stageIndex(s: string) { return STAGE_ORDER.indexOf(s); }

function statusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  const m: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    completed: 'default', running: 'secondary', failed: 'destructive', awaiting_approval: 'secondary',
    in_progress: 'secondary', awaiting_user: 'secondary',
  };
  return m[status] ?? 'outline';
}

interface CreatePipelineParams { setCreating: (b: boolean) => void; setError: (e: string | null) => void; setName: (s: string) => void; setDescription: (s: string) => void; loadProjects: () => Promise<void>; }
async function doCreatePipeline(e: React.FormEvent, name: string, description: string, p: CreatePipelineParams) {
  e.preventDefault();
  p.setCreating(true);
  p.setError(null);
  try {
    const res = await fetch('/api/pipeline/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, description }) });
    if (!res.ok) throw new Error('Failed to create');
    p.setName('');
    p.setDescription('');
    await p.loadProjects();
  } catch (err) {
    p.setError(err instanceof Error ? err.message : 'Error');
  } finally {
    p.setCreating(false);
  }
}

async function doStartPhase(projectId: string, stage: string): Promise<PhaseData | null> {
  const res = await fetch(`/api/pipeline/projects/${projectId}/phases`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stage }),
  });
  if (!res.ok) return null;
  return res.json() as Promise<PhaseData>;
}

interface ApproveParams { setError: (e: string | null) => void; setSelected: (p: ProjectData) => void; loadPhases: (id: string) => Promise<void>; loadProjects: () => Promise<void>; }
async function doApprove(projectId: string, phaseId: string, approved: boolean, p: ApproveParams) {
  p.setError(null);
  try {
    await fetch(`/api/pipeline/projects/${projectId}/phases/${phaseId}/approve`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ approved }) });
    const updated = await fetch(`/api/pipeline/projects/${projectId}`);
    if (updated.ok) p.setSelected(await updated.json() as ProjectData);
    await p.loadPhases(projectId);
    await p.loadProjects();
  } catch (err) {
    p.setError(err instanceof Error ? err.message : 'Error');
  }
}

interface LeftPanelProps { name: string; setName: (v: string) => void; description: string; setDescription: (v: string) => void; creating: boolean; error: string | null; projects: ProjectData[]; selected: ProjectData | null; onSubmit: (e: React.FormEvent) => void; onSelect: (p: ProjectData) => void; onDelete: (id: string) => void; }
function PipelineLeftPanel({ name, setName, description, setDescription, creating, error, projects, selected, onSubmit, onSelect, onDelete }: LeftPanelProps) {
  return (
    <div className="w-72 flex-shrink-0 space-y-4">
      <h2 className="text-lg font-semibold">Pipeline Projects</h2>
      <form onSubmit={onSubmit} className="space-y-2 rounded border p-3">
        <div>
          <Label htmlFor="pipeline-name" className="mb-1 block text-xs text-muted-foreground">Project name</Label>
          <Input id="pipeline-name" placeholder="Project name" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div>
          <Label htmlFor="pipeline-desc" className="mb-1 block text-xs text-muted-foreground">Description</Label>
          <Textarea id="pipeline-desc" placeholder="Description (optional)" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <Button type="submit" disabled={creating} className="w-full">{creating ? 'Creating…' : 'New Pipeline'}</Button>
      </form>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <ul className="space-y-2">
        {projects.map((p) => (
          <li key={p.id} className={`cursor-pointer rounded border p-3 text-sm ${selected?.id === p.id ? 'border-info bg-info/10' : 'hover:bg-muted'}`} onClick={() => onSelect(p)}>
            <div className="flex items-start justify-between">
              <span className="font-medium">{p.name}</span>
              <Badge variant={statusVariant(p.status)} className="text-xs">{p.status}</Badge>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">{STAGE_LABEL[p.currentStage] ?? p.currentStage}</p>
            <Button size="sm" variant="ghost" className="mt-1 h-auto p-0 text-xs text-destructive hover:text-destructive"
              onClick={(e) => { e.stopPropagation(); onDelete(p.id); }}>Delete</Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ApproveButtons({ onApprove }: { onApprove: (v: boolean) => void }) {
  return (
    <div className="flex gap-1">
      <Button size="sm" variant="default" onClick={() => onApprove(true)}>Approve</Button>
      <Button size="sm" variant="destructive" onClick={() => onApprove(false)}>Reject</Button>
    </div>
  );
}

function usePhaseCardState(selectedId: string, stage: string, onPhaseStarted: (p: PhaseData) => void) {
  const [startingPhase, setStartingPhase] = useState(false);
  const [activePhase, setActivePhase] = useState<PhaseData | null>(null);
  const handleRun = useCallback(async () => {
    setStartingPhase(true);
    const started = await doStartPhase(selectedId, stage);
    setStartingPhase(false);
    if (started) { setActivePhase(started); onPhaseStarted(started); }
  }, [selectedId, stage, onPhaseStarted]);
  return { startingPhase, activePhase, setActivePhase, handleRun };
}

interface PhaseHeaderProps { stage: string; phase: PhaseData | undefined; canRun: boolean; canApprove: boolean; starting: boolean; onRun: () => void; onApprove: (v: boolean) => void; }
function PhaseHeader({ stage, phase, canRun, canApprove, starting, onRun, onApprove }: PhaseHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <h3 className="font-medium text-sm">{STAGE_LABEL[stage]}</h3>
      <div className="flex items-center gap-2">
        {phase && <Badge variant={statusVariant(phase.status)} className="text-xs">{phase.status}</Badge>}
        {canRun && <Button size="sm" onClick={onRun} disabled={starting}>{starting ? 'Starting…' : 'Run'}</Button>}
        {canApprove && <ApproveButtons onApprove={onApprove} />}
      </div>
    </div>
  );
}

interface PhaseBodyProps { streamPhase: PhaseData | null; phase: PhaseData | undefined; selectedId: string; stage: string; onComplete: () => void; }
function PhaseBody({ streamPhase, phase, selectedId, stage, onComplete }: PhaseBodyProps) {
  if (streamPhase) {
    return <div className="mt-3"><PhaseStreamView projectId={selectedId} phaseId={streamPhase.id} stage={stage} onComplete={onComplete} /></div>;
  }
  if (phase?.status === 'completed' && phase.artifactPath) {
    return <p className="mt-2 text-xs text-muted-foreground">Artifact: {phase.artifactPath}</p>;
  }
  return null;
}

interface PhaseCardProps { stage: string; phase: PhaseData | undefined; selected: ProjectData; isActive: boolean; canApprove: boolean; onApprove: (approved: boolean) => void; onPhaseStarted: (phase: PhaseData) => void; onPhaseComplete: (projectId: string) => void; }
function PhaseCard({ stage, phase, selected, isActive, canApprove, onApprove, onPhaseStarted, onPhaseComplete }: PhaseCardProps) {
  const { startingPhase, activePhase, setActivePhase, handleRun } = usePhaseCardState(selected.id, stage, onPhaseStarted);
  const canRun = isActive && (!phase || phase.status === 'pending') && !activePhase;
  const streamPhase = activePhase ?? (phase?.status === 'in_progress' ? phase : null);
  const handleComplete = useCallback(() => { setActivePhase(null); onPhaseComplete(selected.id); }, [selected.id, setActivePhase, onPhaseComplete]);
  return (
    <div className={`rounded border p-4 ${isActive ? 'border-info' : ''}`}>
      <PhaseHeader stage={stage} phase={phase} canRun={canRun} canApprove={canApprove} starting={startingPhase} onRun={() => { void handleRun(); }} onApprove={onApprove} />
      <PhaseBody streamPhase={streamPhase} phase={phase} selectedId={selected.id} stage={stage} onComplete={handleComplete} />
    </div>
  );
}

interface RightPanelProps { selected: ProjectData | null; phases: PhaseData[]; currentStageIdx: number; onApprove: (id: string, phaseId: string, approved: boolean) => void; onRefresh: (id: string) => void; }
function PipelineRightPanel({ selected, phases, currentStageIdx, onApprove, onRefresh }: RightPanelProps) {
  if (!selected) return <div className="flex flex-1 h-full items-center justify-center text-muted-foreground">Select a pipeline project to view phases</div>;
  return (
    <div className="flex-1 overflow-auto space-y-6">
      <div>
        <h2 className="text-xl font-semibold">{selected.name}</h2>
        {selected.description && <p className="text-sm text-muted-foreground">{selected.description}</p>}
        <p className="mt-1 text-sm text-muted-foreground">Tokens: {selected.metrics.totalTokens} · Phases: {selected.metrics.phasesCompleted}</p>
      </div>
      <div className="flex gap-1">
        {STAGES.map((stage, i) => (
          <div key={stage} className={`flex-1 rounded px-2 py-1.5 text-center text-xs font-medium ${i < currentStageIdx ? 'bg-success/15 text-success' : i === currentStageIdx ? 'bg-info/15 text-info ring-1 ring-info' : 'bg-muted text-muted-foreground'}`}>
            {STAGE_LABEL[stage]}
          </div>
        ))}
      </div>
      {STAGES.map((stage) => {
        const phase = phases.find((p) => p.stage === stage);
        const idx = stageIndex(stage);
        const isActive = idx === currentStageIdx;
        return (
          <PhaseCard
            key={stage}
            stage={stage}
            phase={phase}
            selected={selected}
            isActive={isActive}
            canApprove={stage === 'approval' && phase?.status === 'awaiting_user'}
            onApprove={(approved) => phase && onApprove(selected.id, phase.id, approved)}
            onPhaseStarted={() => { void onRefresh(selected.id); }}
            onPhaseComplete={(id) => { void onRefresh(id); }}
          />
        );
      })}
    </div>
  );
}

export function PipelineView() {
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [selected, setSelected] = useState<ProjectData | null>(null);
  const [phases, setPhases] = useState<PhaseData[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadProjects = useCallback(async () => {
    const res = await fetch('/api/pipeline/projects');
    if (res.ok) setProjects(await res.json() as ProjectData[]);
  }, []);

  const loadPhases = useCallback(async (projectId: string) => {
    const res = await fetch(`/api/pipeline/projects/${projectId}/phases`);
    if (res.ok) setPhases(await res.json() as PhaseData[]);
  }, []);

  useEffect(() => { void loadProjects(); }, [loadProjects]);

  const handleCreate = (e: React.FormEvent) => void doCreatePipeline(e, name, description, { setCreating, setError, setName, setDescription, loadProjects });

  const handleApprove = (id: string, phaseId: string, approved: boolean) =>
    void doApprove(id, phaseId, approved, { setError, setSelected, loadPhases, loadProjects });

  const handleSelect = async (p: ProjectData) => {
    setSelected(p);
    await loadPhases(p.id);
  };

  const handleDelete = async (projectId: string) => {
    await fetch(`/api/pipeline/projects/${projectId}`, { method: 'DELETE' });
    if (selected?.id === projectId) { setSelected(null); setPhases([]); }
    await loadProjects();
  };

  const handleRefresh = async (id: string) => {
    const [projectRes] = await Promise.all([
      fetch(`/api/pipeline/projects/${id}`),
      loadPhases(id),
    ]);
    if (projectRes.ok) setSelected(await projectRes.json() as ProjectData);
    await loadProjects();
  };

  return (
    <div className="flex h-full gap-6 p-6">
      <PipelineLeftPanel name={name} setName={setName} description={description} setDescription={setDescription}
        creating={creating} error={error} projects={projects} selected={selected}
        onSubmit={handleCreate} onSelect={(p) => { void handleSelect(p); }} onDelete={(id) => { void handleDelete(id); }} />
      <PipelineRightPanel selected={selected} phases={phases} currentStageIdx={selected ? stageIndex(selected.currentStage) : -1}
        onApprove={handleApprove} onRefresh={handleRefresh} />
    </div>
  );
}
