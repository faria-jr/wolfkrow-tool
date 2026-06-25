'use client';

import type React from 'react';
import { useCallback, useEffect, useState } from 'react';

import { Input } from '@/components/ui/input';
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
  discovery: 'Discovery',
  spec_build: 'Spec Build',
  spec_validate: 'Spec Validate',
  approval: 'Approval',
  implementation: 'Implementation',
  completed: 'Completed',
};
const STAGES = STAGE_ORDER.filter((s) => s !== 'completed');

function stageIndex(s: string) { return STAGE_ORDER.indexOf(s); }
function statusBadge(status: string): string {
  const m: Record<string, string> = {
    running: 'bg-info/15 text-info', paused: 'bg-warning/15 text-warning',
    awaiting_approval: 'bg-warning/15 text-warning', completed: 'bg-success/15 text-success',
    failed: 'bg-destructive/15 text-destructive', cancelled: 'bg-muted text-muted-foreground',
    in_progress: 'bg-primary/15 text-primary', pending: 'bg-muted text-muted-foreground',
    awaiting_user: 'bg-warning/15 text-warning', skipped: 'bg-muted text-muted-foreground',
  };
  return m[status] ?? 'bg-muted text-muted-foreground';
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

interface RunPhaseParams { setRunningPhase: (s: string | null) => void; setError: (e: string | null) => void; setPhaseOutput: React.Dispatch<React.SetStateAction<Record<string, string>>>; setSelected: (p: ProjectData) => void; loadPhases: (id: string) => Promise<void>; loadProjects: () => Promise<void>; }
async function doRunPhase(projectId: string, stage: string, p: RunPhaseParams) {
  p.setRunningPhase(stage);
  p.setError(null);
  try {
    const startRes = await fetch(`/api/pipeline/projects/${projectId}/phases`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stage }) });
    if (!startRes.ok) throw new Error('Failed to start phase');
    const phaseData = await startRes.json() as PhaseData;
    const runRes = await fetch(`/api/pipeline/projects/${projectId}/phases/${phaseData.id}/run`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    if (!runRes.ok) throw new Error('AI execution failed');
    const runData = await runRes.json() as { output: string; project: ProjectData };
    p.setPhaseOutput((prev) => ({ ...prev, [stage]: runData.output }));
    p.setSelected(runData.project);
    await p.loadPhases(projectId);
    await p.loadProjects();
  } catch (err) {
    p.setError(err instanceof Error ? err.message : 'Error');
  } finally {
    p.setRunningPhase(null);
  }
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
        <Input placeholder="Project name" value={name} onChange={(e) => setName(e.target.value)} required />
        <Textarea placeholder="Description (optional)" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        <button type="submit" disabled={creating} className="w-full rounded bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50">{creating ? 'Creating…' : 'New Pipeline'}</button>
      </form>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <ul className="space-y-2">
        {projects.map((p) => (
          <li key={p.id} className={`cursor-pointer rounded border p-3 text-sm ${selected?.id === p.id ? 'border-info bg-info/10' : 'hover:bg-muted'}`} onClick={() => onSelect(p)}>
            <div className="flex items-start justify-between">
              <span className="font-medium">{p.name}</span>
              <span className={`rounded px-1.5 py-0.5 text-xs ${statusBadge(p.status)}`}>{p.status}</span>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">{STAGE_LABEL[p.currentStage] ?? p.currentStage}</p>
            <button onClick={(e) => { e.stopPropagation(); onDelete(p.id); }} className="mt-1 text-xs text-destructive hover:text-destructive/80">Delete</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

interface PhaseCardProps { stage: string; phase: PhaseData | undefined; isActive: boolean; canRun: boolean; canApprove: boolean; runningPhase: string | null; output: string | undefined; onRun: () => void; onApprove: (approved: boolean) => void; }
function PhaseCard({ stage, phase, isActive, canRun, canApprove, runningPhase, output, onRun, onApprove }: PhaseCardProps) {
  return (
    <div className={`rounded border p-4 ${isActive ? 'border-info' : ''}`}>
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-sm">{STAGE_LABEL[stage]}</h3>
        <div className="flex items-center gap-2">
          {phase && <span className={`rounded px-2 py-0.5 text-xs ${statusBadge(phase.status)}`}>{phase.status}</span>}
          {canRun && <button onClick={onRun} disabled={runningPhase === stage} className="rounded bg-primary px-2 py-1 text-xs text-primary-foreground hover:bg-primary/90 disabled:opacity-50">{runningPhase === stage ? 'Running AI…' : 'Run'}</button>}
          {canApprove && <div className="flex gap-1"><button onClick={() => onApprove(true)} className="rounded bg-success px-2 py-1 text-xs text-success-foreground hover:bg-success/90">Approve</button><button onClick={() => onApprove(false)} className="rounded bg-destructive px-2 py-1 text-xs text-destructive-foreground hover:bg-destructive/90">Reject</button></div>}
        </div>
      </div>
      {output && <pre className="mt-2 overflow-auto rounded bg-muted p-2 text-xs max-h-48 whitespace-pre-wrap">{output}</pre>}
    </div>
  );
}

interface RightPanelProps { selected: ProjectData | null; phases: PhaseData[]; runningPhase: string | null; phaseOutput: Record<string, string>; currentStageIdx: number; onRunPhase: (id: string, stage: string) => void; onApprove: (id: string, phaseId: string, approved: boolean) => void; }
function PipelineRightPanel({ selected, phases, runningPhase, phaseOutput, currentStageIdx, onRunPhase, onApprove }: RightPanelProps) {
  if (!selected) return <div className="flex flex-1 h-full items-center justify-center text-muted-foreground">Select a pipeline project to view phases</div>;
  return (
    <div className="flex-1 overflow-auto">
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold">{selected.name}</h2>
          {selected.description && <p className="text-sm text-muted-foreground">{selected.description}</p>}
          <p className="text-sm text-muted-foreground mt-1">Tokens used: {selected.metrics.totalTokens} · Phases: {selected.metrics.phasesCompleted}</p>
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
              isActive={isActive}
              canRun={isActive && (!phase || phase.status === 'pending')}
              canApprove={stage === 'approval' && phase?.status === 'awaiting_user'}
              runningPhase={runningPhase}
              output={phaseOutput[stage]}
              onRun={() => onRunPhase(selected.id, stage)}
              onApprove={(approved) => phase && onApprove(selected.id, phase.id, approved)}
            />
          );
        })}
      </div>
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
  const [runningPhase, setRunningPhase] = useState<string | null>(null);
  const [phaseOutput, setPhaseOutput] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const loadProjects = useCallback(async () => {
    const res = await fetch(`/api/pipeline/projects`);
    if (res.ok) setProjects(await res.json() as ProjectData[]);
  }, []);

  const loadPhases = useCallback(async (projectId: string) => {
    const res = await fetch(`/api/pipeline/projects/${projectId}/phases`);
    if (res.ok) setPhases(await res.json() as PhaseData[]);
  }, []);

  useEffect(() => { void loadProjects(); }, [loadProjects]);

  const handleCreate = (e: React.FormEvent) => void doCreatePipeline(e, name, description, { setCreating, setError, setName, setDescription, loadProjects });
  const handleRunPhase = (id: string, stage: string) => void doRunPhase(id, stage, { setRunningPhase, setError, setPhaseOutput, setSelected, loadPhases, loadProjects });
  const handleApprove = (id: string, phaseId: string, approved: boolean) => void doApprove(id, phaseId, approved, { setError, setSelected, loadPhases, loadProjects });

  const handleSelect = async (p: ProjectData) => {
    setSelected(p);
    setPhaseOutput({});
    await loadPhases(p.id);
  };

  const handleDelete = async (projectId: string) => {
    await fetch(`/api/pipeline/projects/${projectId}`, { method: 'DELETE' });
    if (selected?.id === projectId) { setSelected(null); setPhases([]); }
    await loadProjects();
  };

  return (
    <div className="flex h-full gap-6 p-6">
      <PipelineLeftPanel name={name} setName={setName} description={description} setDescription={setDescription} creating={creating} error={error} projects={projects} selected={selected} onSubmit={handleCreate} onSelect={(p) => { void handleSelect(p); }} onDelete={(id) => { void handleDelete(id); }} />
      <PipelineRightPanel selected={selected} phases={phases} runningPhase={runningPhase} phaseOutput={phaseOutput} currentStageIdx={selected ? stageIndex(selected.currentStage) : -1} onRunPhase={handleRunPhase} onApprove={handleApprove} />
    </div>
  );
}
