'use client';

import Link from 'next/link';
import type React from 'react';
import { useEffect, useState } from 'react';

import { PipelineTimeline } from './pipeline-timeline';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export interface CentralProject {
  id: string;
  name: string;
  rootPath?: string;
  specPath?: string;
  description?: string;
}

export interface ProjectData {
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
  projectPath?: string;
  metrics: { totalTokens: number; phasesCompleted: number };
  createdAt: string;
}

export interface PhaseData {
  id: string;
  projectId: string;
  stage: string;
  status: string;
  artifactPath?: string;
  startedAt?: string;
  completedAt?: string;
  metrics: { tokens: number; durationMs: number };
}

export const STAGE_ORDER = [
  'discovery',
  'spec_build',
  'spec_validate',
  'approval',
  'design',
  'design_lock',
  'implementation',
  'completed',
];
export const STAGE_LABEL: Record<string, string> = {
  discovery: 'Discovery',
  spec_build: 'Spec Build',
  spec_validate: 'Spec Validate',
  approval: 'Approval',
  design: 'Design',
  design_lock: 'Design Lock',
  implementation: 'Implementation',
  completed: 'Completed',
};
export const STAGES = STAGE_ORDER.filter((s) => s !== 'completed');

export function stageIndex(s: string) {
  return STAGE_ORDER.indexOf(s);
}

export function statusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  const m: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    completed: 'default',
    running: 'secondary',
    failed: 'destructive',
    awaiting_approval: 'secondary',
    in_progress: 'secondary',
    awaiting_user: 'secondary',
  };
  return m[status] ?? 'outline';
}

function useCentralProjects() {
  const [projects, setProjects] = useState<CentralProject[]>([]);
  useEffect(() => {
    fetch('/api/projects')
      .then((r) => (r.ok ? r.json() : []))
      .then((data: CentralProject[]) => setProjects(data))
      .catch(() => setProjects([]));
  }, []);
  return projects;
}

interface LeftPanelProps {
  name: string;
  setName: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  projectPath: string;
  setProjectPath: (v: string) => void;
  creating: boolean;
  error: string | null;
  projects: ProjectData[];
  selected: ProjectData | null;
  onSubmit: (e: React.FormEvent) => void;
  onSelect: (p: ProjectData) => void;
  onDelete: (id: string) => void;
}
export function PipelineLeftPanel({
  name,
  setName,
  description,
  setDescription,
  projectPath,
  setProjectPath,
  creating,
  error,
  projects,
  selected,
  onSubmit,
  onSelect,
  onDelete,
}: LeftPanelProps) {
  const centralProjects = useCentralProjects();
  return (
    <div className="w-72 flex-shrink-0 space-y-4">
      <h2 className="text-lg font-semibold">Pipeline Projects</h2>
      <form onSubmit={onSubmit} className="space-y-2 rounded border p-3">
        {centralProjects.length > 0 && (
          <div>
            <Label className="text-muted-foreground mb-1 block text-xs">Quick fill from project</Label>
            <select
              className="border-input bg-background text-foreground w-full rounded border px-2 py-1.5 text-sm"
              onChange={(e) => {
                const p = centralProjects.find((cp) => cp.id === e.target.value);
                if (p) {
                  setName(p.name);
                  setDescription(p.description ?? '');
                  setProjectPath(p.rootPath ?? '');
                }
              }}
              defaultValue=""
            >
              <option value="">— select a project —</option>
              {centralProjects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        )}
        <div>
          <Label htmlFor="pipeline-name" className="text-muted-foreground mb-1 block text-xs">
            Project name
          </Label>
          <Input
            id="pipeline-name"
            placeholder="Project name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div>
          <Label htmlFor="pipeline-desc" className="text-muted-foreground mb-1 block text-xs">
            Description
          </Label>
          <Textarea
            id="pipeline-desc"
            placeholder="Description (optional)"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="pipeline-path" className="text-muted-foreground mb-1 block text-xs">
            Project path
          </Label>
          <Input
            id="pipeline-path"
            placeholder="Project path (e.g. /Users/me/my-repo)"
            value={projectPath}
            onChange={(e) => setProjectPath(e.target.value)}
          />
        </div>
        <Button type="submit" disabled={creating} className="w-full">
          {creating ? 'Creating…' : 'New Pipeline'}
        </Button>
      </form>
      {error && <p className="text-destructive text-sm">{error}</p>}
      <ul className="space-y-2">
        {projects.map((p) => (
          <li
            key={p.id}
            className={`cursor-pointer rounded border p-3 text-sm ${selected?.id === p.id ? 'border-info bg-info/10' : 'hover:bg-muted'}`}
            onClick={() => onSelect(p)}
          >
            <div className="flex items-start justify-between">
              <span className="font-medium">{p.name}</span>
              <Badge variant={statusVariant(p.status)} className="text-xs">
                {p.status}
              </Badge>
            </div>
            <p className="text-muted-foreground mt-0.5 text-xs">
              {STAGE_LABEL[p.currentStage] ?? p.currentStage}
            </p>
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive hover:text-destructive mt-1 h-auto p-0 text-xs"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(p.id);
              }}
            >
              Delete
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ApproveButtons({ onApprove }: { onApprove: (v: boolean) => void }) {
  return (
    <div className="flex gap-1">
      <Button size="sm" variant="default" onClick={() => onApprove(true)}>
        Approve
      </Button>
      <Button size="sm" variant="destructive" onClick={() => onApprove(false)}>
        Reject
      </Button>
    </div>
  );
}

interface PhaseHeaderProps {
  stage: string;
  phase: PhaseData | undefined;
  canRun: boolean;
  canApprove: boolean;
  projectId: string;
  onApprove: (v: boolean) => void;
}
function PhaseHeader({ stage, phase, canRun, canApprove, projectId, onApprove }: PhaseHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <h3 className="text-sm font-medium">{STAGE_LABEL[stage]}</h3>
      <div className="flex items-center gap-2">
        {phase && (
          <Badge variant={statusVariant(phase.status)} className="text-xs">
            {phase.status}
          </Badge>
        )}
        {canRun && (
          <Button size="sm" asChild>
            <Link href={`/pipeline/${projectId}/run?stage=${stage}&autoplay=1`}>Run</Link>
          </Button>
        )}
        {canApprove && <ApproveButtons onApprove={onApprove} />}
      </div>
    </div>
  );
}

function PhaseBody({ phase }: { phase: PhaseData | undefined }) {
  if (phase?.status === 'completed' && phase.artifactPath) {
    return <p className="text-muted-foreground mt-2 text-xs">Artifact: {phase.artifactPath}</p>;
  }
  return null;
}

interface PhaseCardProps {
  stage: string;
  phase: PhaseData | undefined;
  selected: ProjectData;
  isActive: boolean;
  canApprove: boolean;
  onApprove: (approved: boolean) => void;
}
function PhaseCard({ stage, phase, selected, isActive, canApprove, onApprove }: PhaseCardProps) {
  const canRun = isActive && (!phase || phase.status === 'pending');
  return (
    <div className={`rounded border p-4 ${isActive ? 'border-info' : ''}`}>
      <PhaseHeader
        stage={stage}
        phase={phase}
        canRun={canRun}
        canApprove={canApprove}
        projectId={selected.id}
        onApprove={onApprove}
      />
      <PhaseBody phase={phase} />
    </div>
  );
}

interface RightPanelProps {
  selected: ProjectData | null;
  phases: PhaseData[];
  currentStageIdx: number;
  onApprove: (id: string, phaseId: string, approved: boolean) => void;
}
export function PipelineRightPanel({ selected, phases, currentStageIdx, onApprove }: RightPanelProps) {
  if (!selected)
    return (
      <div className="text-muted-foreground flex h-full flex-1 items-center justify-center">
        Select a pipeline project to view phases
      </div>
    );
  return (
    <div className="flex-1 space-y-6 overflow-auto">
      <div>
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-xl font-semibold">{selected.name}</h2>
            {selected.description && (
              <p className="text-muted-foreground text-sm">{selected.description}</p>
            )}
            <p className="text-muted-foreground mt-1 text-sm">
              Tokens: {selected.metrics.totalTokens} · Phases: {selected.metrics.phasesCompleted}
            </p>
          </div>
          <Button size="sm" variant="outline" asChild>
            <Link href={`/pipeline/projects/${selected.id}/report`}>Report</Link>
          </Button>
        </div>
      </div>
      <PipelineTimeline
        phases={phases}
        selectedStage={currentStageIdx >= 0 ? (STAGES[currentStageIdx] ?? '') : ''}
        onSelectStage={() => {
          /* read-only listing timeline; selection lives in the run console */
        }}
      />
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
          />
        );
      })}
    </div>
  );
}
