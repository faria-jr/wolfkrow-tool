'use client';

import Link from 'next/link';
import type React from 'react';
import { useEffect, useState } from 'react';

import { MetricsChart } from './metrics-chart';
import { MetricsPanel } from './metrics-panel';
import { RoundsList } from './rounds-list';
import { SprintMetricsTable } from './sprint-metrics-table';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { statusBadgeVariant } from '@/lib/status-badge';

export interface ProjectData {
  id: string;
  userId: string;
  name: string;
  description?: string;
  specPath: string;
  projectPath?: string;
  status: string;
  config: { maxRoundsPerFeature: number; coderModel: string; plannerModel: string };
  metrics: {
    totalTokens: number;
    totalCost: number;
    roundCount: number;
    featuresPassed: number;
    featuresTotal: number;
    totalDurationMs: number;
  };
  createdAt: string;
}

export interface SprintData {
  id: string;
  projectId: string;
  number: number;
  name: string;
  description?: string;
  status: string;
  features: Array<{ name: string; description: string; acceptanceCriteria: string[] }>;
}

export interface CentralProject {
  id: string;
  name: string;
  rootPath?: string;
  specPath?: string;
  description?: string;
}

export interface NewProjectForm {
  name: string;
  specPath: string;
  projectPath: string;
  description: string;
  maxRoundsPerFeature: number;
}

export const EMPTY_FORM: NewProjectForm = {
  name: '',
  specPath: '',
  projectPath: '',
  description: '',
  maxRoundsPerFeature: 5,
};

export function useCentralProjects() {
  const [projects, setProjects] = useState<CentralProject[]>([]);
  useEffect(() => {
    fetch('/api/projects')
      .then((r) => (r.ok ? r.json() : []))
      .then((data: CentralProject[]) => setProjects(data))
      .catch(() => setProjects([]));
  }, []);
  return projects;
}

interface CreateFormProps {
  form: NewProjectForm;
  setForm: (f: NewProjectForm) => void;
  creating: boolean;
  onSubmit: (e: React.FormEvent) => void;
}
export function ProjectCreateForm({ form, setForm, creating, onSubmit }: CreateFormProps) {
  const centralProjects = useCentralProjects();
  return (
    <form onSubmit={onSubmit} className="space-y-2 rounded border p-3">
      {centralProjects.length > 0 && (
        <div>
          <label className="text-muted-foreground mb-1 block text-xs">Quick fill from project</label>
          <select
            className="border-input bg-background text-foreground w-full rounded border px-2 py-1.5 text-sm"
            onChange={(e) => {
              const p = centralProjects.find((cp) => cp.id === e.target.value);
              if (p) {
                setForm({
                  ...form,
                  name: p.name,
                  specPath: p.specPath ?? form.specPath,
                  projectPath: p.rootPath ?? form.projectPath,
                  description: p.description ?? form.description,
                });
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
      <Input
        placeholder="Project name"
        value={form.name}
        onChange={(e) => setForm({ ...form, name: e.target.value })}
        required
      />
      <Input
        placeholder="Spec path (e.g. /docs/spec.md)"
        value={form.specPath}
        onChange={(e) => setForm({ ...form, specPath: e.target.value })}
        required
      />
      <Input
        placeholder="Project path (e.g. /Users/me/my-repo)"
        value={form.projectPath}
        onChange={(e) => setForm({ ...form, projectPath: e.target.value })}
      />
      <Input
        placeholder="Description (optional)"
        value={form.description}
        onChange={(e) => setForm({ ...form, description: e.target.value })}
      />
      <div className="flex items-center gap-2 text-sm">
        <label>Max rounds:</label>
        <Input
          type="number"
          min={1}
          max={20}
          className="w-16"
          value={form.maxRoundsPerFeature}
          onChange={(e) => setForm({ ...form, maxRoundsPerFeature: Number(e.target.value) })}
        />
      </div>
      <Button type="submit" disabled={creating} className="w-full">
        {creating ? 'Creating…' : 'Create Project'}
      </Button>
    </form>
  );
}

interface ListItemProps {
  project: ProjectData;
  isSelected: boolean;
  onSelect: () => void;
  onPlan: () => void;
  onDelete: () => void;
  planning: boolean;
}
export function ProjectListItem({
  project: p,
  isSelected,
  onSelect,
  onPlan,
  onDelete,
  planning,
}: ListItemProps) {
  return (
    <li
      className={`cursor-pointer rounded border p-3 ${isSelected ? 'border-info bg-info/15' : 'hover:bg-muted'}`}
      onClick={onSelect}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium">{p.name}</p>
          {p.description && <p className="text-muted-foreground text-xs">{p.description}</p>}
        </div>
        <Badge variant={statusBadgeVariant(p.status)} className="text-xs">
          {p.status}
        </Badge>
      </div>
      <div className="mt-2 flex gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={(e) => {
            e.stopPropagation();
            onPlan();
          }}
          disabled={planning}
        >
          {planning ? 'Planning…' : 'Plan Sprints'}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="text-destructive hover:text-destructive"
        >
          Delete
        </Button>
      </div>
    </li>
  );
}

interface SprintCardProps {
  sprint: SprintData;
  projectId: string;
}
export function SprintCard({ sprint, projectId }: SprintCardProps) {
  return (
    <div className="rounded border p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">
          Sprint {sprint.number}: {sprint.name}
        </h3>
        <div className="flex items-center gap-2">
          <Badge variant={statusBadgeVariant(sprint.status)} className="text-xs">
            {sprint.status}
          </Badge>
          <Button size="sm" asChild>
            <Link href={`/harness/${projectId}/run?sprintId=${sprint.id}&autoplay=1`}>Run</Link>
          </Button>
        </div>
      </div>
      {sprint.description && (
        <p className="text-muted-foreground mt-1 text-sm">{sprint.description}</p>
      )}
      <div className="text-muted-foreground mt-2 text-xs">
        {sprint.features.length} feature{sprint.features.length !== 1 ? 's' : ''}
      </div>
      <RoundsList sprintId={sprint.id} />
      <SprintMetricsTable sprintId={sprint.id} />
      <MetricsChart sprintId={sprint.id} />
    </div>
  );
}

interface SprintPanelProps {
  selected: ProjectData | null;
  sprints: SprintData[];
}
export function SprintPanel({ selected, sprints }: SprintPanelProps) {
  if (!selected)
    return (
      <div className="text-muted-foreground flex h-full flex-1 items-center justify-center">
        Select a project to view sprints
      </div>
    );
  return (
    <div className="flex flex-1 flex-col gap-4 overflow-auto">
      <div>
        <h2 className="text-lg font-semibold">{selected.name}</h2>
        {selected.projectPath && (
          <p className="text-muted-foreground text-xs">Path: {selected.projectPath}</p>
        )}
        <p className="text-muted-foreground text-sm">
          Status: <strong>{selected.status}</strong>
        </p>
      </div>
      <MetricsPanel metrics={selected.metrics} />
      {sprints.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No sprints yet. Click "Plan Sprints" to generate them.
        </p>
      ) : (
        sprints.map((sprint) => (
          <SprintCard key={sprint.id} sprint={sprint} projectId={selected.id} />
        ))
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
export function ProjectListPanel({
  form,
  setForm,
  creating,
  error,
  projects,
  selected,
  planning,
  onCreate,
  onSelect,
  onPlan,
  onDelete,
}: ProjectListPanelProps) {
  return (
    <div className="w-80 flex-shrink-0 space-y-4">
      <h2 className="text-lg font-semibold">Projects</h2>
      <ProjectCreateForm form={form} setForm={setForm} creating={creating} onSubmit={onCreate} />
      {error && <p className="text-destructive text-sm">{error}</p>}
      <ul className="space-y-2">
        {projects.map((p) => (
          <ProjectListItem
            key={p.id}
            project={p}
            isSelected={selected?.id === p.id}
            onSelect={() => {
              void onSelect(p);
            }}
            onPlan={() => onPlan(p.id)}
            onDelete={() => {
              void onDelete(p.id);
            }}
            planning={planning === p.id}
          />
        ))}
      </ul>
    </div>
  );
}
