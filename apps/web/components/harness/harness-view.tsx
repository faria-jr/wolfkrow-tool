'use client';

import type React from 'react';
import { useCallback, useEffect, useState } from 'react';

import { RoundsList } from './rounds-list';

import { Input } from '@/components/ui/input';

interface ProjectData {
  id: string;
  userId: string;
  name: string;
  description?: string;
  specPath: string;
  status: string;
  config: { maxRoundsPerFeature: number; coderModel: string; plannerModel: string };
  metrics: { totalTokens: number; totalCost: number; roundCount: number; featuresPassed: number; featuresTotal: number; totalDurationMs: number };
  createdAt: string;
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

interface NewProjectForm { name: string; specPath: string; description: string; maxRoundsPerFeature: number; }

const EMPTY_FORM: NewProjectForm = { name: '', specPath: '', description: '', maxRoundsPerFeature: 5 };
const USER_ID = 'user-1';

function statusColor(status: string): string {
  const map: Record<string, string> = {
    planning: 'bg-warning/15 text-warning',
    ready: 'bg-info/15 text-info',
    running: 'bg-primary/15 text-primary',
    completed: 'bg-success/15 text-success',
    failed: 'bg-destructive/15 text-destructive',
    paused: 'bg-muted text-muted-foreground',
  };
  return map[status] ?? 'bg-muted text-muted-foreground';
}

interface CreateParams { form: NewProjectForm; setCreating: (b: boolean) => void; setError: (e: string | null) => void; setForm: (f: NewProjectForm) => void; load: () => Promise<void>; }
async function doCreate(e: React.FormEvent, p: CreateParams) {
  e.preventDefault();
  p.setCreating(true);
  p.setError(null);
  try {
    const res = await fetch('/api/harness/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...p.form, userId: USER_ID }),
    });
    if (!res.ok) throw new Error('Failed to create project');
    p.setForm(EMPTY_FORM);
    await p.load();
  } catch (err) {
    p.setError(err instanceof Error ? err.message : 'Error');
  } finally {
    p.setCreating(false);
  }
}

interface PlanParams { setPlanningId: (id: string | null) => void; setError: (e: string | null) => void; setSprints: (s: SprintData[]) => void; load: () => Promise<void>; }
async function doPlan(projectId: string, p: PlanParams) {
  p.setPlanningId(projectId);
  p.setError(null);
  try {
    const res = await fetch(`/api/harness/projects/${projectId}/plan`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    if (!res.ok) throw new Error('Planning failed');
    p.setSprints(await res.json() as SprintData[]);
    await p.load();
  } catch (err) {
    p.setError(err instanceof Error ? err.message : 'Error');
  } finally {
    p.setPlanningId(null);
  }
}

interface CreateFormProps { form: NewProjectForm; setForm: (f: NewProjectForm) => void; creating: boolean; onSubmit: (e: React.FormEvent) => void; }
function ProjectCreateForm({ form, setForm, creating, onSubmit }: CreateFormProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-2 rounded border p-3">
      <Input placeholder="Project name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
      <Input placeholder="Spec path (e.g. /docs/spec.md)" value={form.specPath} onChange={(e) => setForm({ ...form, specPath: e.target.value })} required />
      <Input placeholder="Description (optional)" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
      <div className="flex items-center gap-2 text-sm">
        <label>Max rounds:</label>
        <Input type="number" min={1} max={20} className="w-16" value={form.maxRoundsPerFeature} onChange={(e) => setForm({ ...form, maxRoundsPerFeature: Number(e.target.value) })} />
      </div>
      <button type="submit" disabled={creating} className="w-full rounded bg-info px-3 py-1.5 text-sm text-info-foreground hover:bg-info/90 disabled:opacity-50">
        {creating ? 'Creating…' : 'Create Project'}
      </button>
    </form>
  );
}

interface ListItemProps { project: ProjectData; isSelected: boolean; onSelect: () => void; onPlan: () => void; onDelete: () => void; planning: boolean; }
function ProjectListItem({ project: p, isSelected, onSelect, onPlan, onDelete, planning }: ListItemProps) {
  return (
    <li className={`cursor-pointer rounded border p-3 ${isSelected ? 'border-info bg-info/15' : 'hover:bg-muted'}`} onClick={onSelect}>
      <div className="flex items-start justify-between">
        <div>
          <p className="font-medium text-sm">{p.name}</p>
          {p.description && <p className="text-xs text-muted-foreground">{p.description}</p>}
        </div>
        <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${statusColor(p.status)}`}>{p.status}</span>
      </div>
      <div className="mt-2 flex gap-2">
        <button onClick={(e) => { e.stopPropagation(); onPlan(); }} disabled={planning} className="rounded bg-primary px-2 py-1 text-xs text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
          {planning ? 'Planning…' : 'Plan Sprints'}
        </button>
        <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="rounded border border-destructive/30 px-2 py-1 text-xs text-destructive hover:bg-destructive/10">
          Delete
        </button>
      </div>
    </li>
  );
}

function SprintFeature({ feature: f, index }: { feature: SprintData['features'][number]; index: number }) {
  return (
    <div key={index} className="rounded bg-muted p-3">
      <p className="font-medium text-sm">{f.name}</p>
      <p className="text-xs text-muted-foreground">{f.description}</p>
      {f.acceptanceCriteria.length > 0 && (
        <ul className="mt-1 list-disc list-inside text-xs text-muted-foreground">
          {f.acceptanceCriteria.map((c, j) => <li key={j}>{c}</li>)}
        </ul>
      )}
    </div>
  );
}

function SprintCard({ sprint }: { sprint: SprintData }) {
  return (
    <div key={sprint.id} className="rounded border p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">Sprint {sprint.number}: {sprint.name}</h3>
        <span className={`rounded px-2 py-0.5 text-xs ${statusColor(sprint.status)}`}>{sprint.status}</span>
      </div>
      {sprint.description && <p className="mt-1 text-sm text-muted-foreground">{sprint.description}</p>}
      <div className="mt-3 space-y-2">
        {sprint.features.map((f, i) => <SprintFeature key={i} feature={f} index={i} />)}
      </div>
      <RoundsList sprintId={sprint.id} />
    </div>
  );
}

interface SprintPanelProps { selected: ProjectData | null; sprints: SprintData[]; }
function SprintPanel({ selected, sprints }: SprintPanelProps) {
  if (!selected) return <div className="flex h-full flex-1 items-center justify-center text-muted-foreground">Select a project to view sprints</div>;
  return (
    <div className="flex-1 overflow-auto space-y-4">
      <div>
        <h2 className="text-lg font-semibold">{selected.name}</h2>
        <p className="text-sm text-muted-foreground">Status: <strong>{selected.status}</strong> · Tokens: {selected.metrics.totalTokens} · Features passed: {selected.metrics.featuresPassed}/{selected.metrics.featuresTotal}</p>
      </div>
      {sprints.length === 0 ? (
        <p className="text-sm text-muted-foreground">No sprints yet. Click &quot;Plan Sprints&quot; to generate them.</p>
      ) : (
        sprints.map((sprint) => <SprintCard key={sprint.id} sprint={sprint} />)
      )}
    </div>
  );
}

interface ProjectListPanelProps {
  form: NewProjectForm;
  setForm: (f: NewProjectForm) => void;
  creating: boolean;
  error: string | null;
  projects: ProjectData[];
  selected: ProjectData | null;
  planning: string | null;
  onCreate: (e: React.FormEvent) => void;
  onSelect: (p: ProjectData) => void;
  onPlan: (id: string) => void;
  onDelete: (id: string) => void;
}
function ProjectListPanel({ form, setForm, creating, error, projects, selected, planning, onCreate, onSelect, onPlan, onDelete }: ProjectListPanelProps) {
  return (
    <div className="w-80 flex-shrink-0 space-y-4">
      <h2 className="text-lg font-semibold">Projects</h2>
      <ProjectCreateForm form={form} setForm={setForm} creating={creating} onSubmit={onCreate} />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <ul className="space-y-2">
        {projects.map((p) => (
          <ProjectListItem
            key={p.id}
            project={p}
            isSelected={selected?.id === p.id}
            onSelect={() => { void onSelect(p); }}
            onPlan={() => onPlan(p.id)}
            onDelete={() => { void onDelete(p.id); }}
            planning={planning === p.id}
          />
        ))}
      </ul>
    </div>
  );
}

export function HarnessView() {
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [selected, setSelected] = useState<ProjectData | null>(null);
  const [sprints, setSprints] = useState<SprintData[]>([]);
  const [form, setForm] = useState<NewProjectForm>(EMPTY_FORM);
  const [creating, setCreating] = useState(false);
  const [planning, setPlanningId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadProjects = useCallback(async () => {
    const res = await fetch(`/api/harness/projects?userId=${USER_ID}`);
    if (res.ok) setProjects(await res.json() as ProjectData[]);
  }, []);

  useEffect(() => { void loadProjects(); }, [loadProjects]);

  const handleCreate = (e: React.FormEvent) => void doCreate(e, { form, setCreating, setError, setForm, load: loadProjects });
  const handlePlan = (projectId: string) => void doPlan(projectId, { setPlanningId, setError, setSprints, load: loadProjects });

  const handleSelect = async (p: ProjectData) => {
    setSelected(p);
    const res = await fetch(`/api/harness/projects/${p.id}/sprints`);
    if (res.ok) setSprints(await res.json() as SprintData[]);
    else setSprints([]);
  };

  const handleDelete = async (projectId: string) => {
    await fetch(`/api/harness/projects/${projectId}?userId=${USER_ID}`, { method: 'DELETE' });
    if (selected?.id === projectId) { setSelected(null); setSprints([]); }
    await loadProjects();
  };

  return (
    <div className="flex h-full flex-col gap-6">
      <ProjectListPanel
        form={form}
        setForm={setForm}
        creating={creating}
        error={error}
        projects={projects}
        selected={selected}
        planning={planning}
        onCreate={handleCreate}
        onSelect={handleSelect}
        onPlan={handlePlan}
        onDelete={handleDelete}
      />
      <SprintPanel selected={selected} sprints={sprints} />
    </div>
  );
}
