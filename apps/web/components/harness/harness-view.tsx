'use client';

import type React from 'react';
import { useCallback, useEffect, useState } from 'react';

import {
  EMPTY_FORM,
  ProjectListPanel,
  SprintPanel,
  type NewProjectForm,
  type ProjectData,
  type SprintData,
} from './harness-subcomponents';

interface CreateParams {
  form: NewProjectForm;
  setCreating: (b: boolean) => void;
  setError: (e: string | null) => void;
  setForm: (f: NewProjectForm) => void;
  load: () => Promise<void>;
}
async function doCreate(e: React.FormEvent, p: CreateParams) {
  e.preventDefault();
  p.setCreating(true);
  p.setError(null);
  try {
    const body: Record<string, unknown> = {
      name: p.form.name,
      specPath: p.form.specPath,
      maxRoundsPerFeature: p.form.maxRoundsPerFeature,
    };
    if (p.form.projectPath) body['projectPath'] = p.form.projectPath;
    if (p.form.description) body['description'] = p.form.description;
    const res = await fetch('/api/harness/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Failed to create project');
    }
    p.setForm(EMPTY_FORM);
    await p.load();
  } catch (err) {
    p.setError(err instanceof Error ? err.message : 'Error');
  } finally {
    p.setCreating(false);
  }
}

interface PlanParams {
  setPlanningId: (id: string | null) => void;
  setError: (e: string | null) => void;
  setSprints: (s: SprintData[]) => void;
  load: () => Promise<void>;
}
async function doPlan(projectId: string, p: PlanParams) {
  p.setPlanningId(projectId);
  p.setError(null);
  try {
    const res = await fetch(`/api/harness/projects/${projectId}/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    if (!res.ok) throw new Error('Planning failed');
    p.setSprints((await res.json()) as SprintData[]);
    await p.load();
  } catch (err) {
    p.setError(err instanceof Error ? err.message : 'Error');
  } finally {
    p.setPlanningId(null);
  }
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
    const res = await fetch('/api/harness/projects');
    if (res.ok) setProjects((await res.json()) as ProjectData[]);
  }, []);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  const handleCreate = (e: React.FormEvent) =>
    void doCreate(e, { form, setCreating, setError, setForm, load: loadProjects });
  const handlePlan = (projectId: string) =>
    void doPlan(projectId, { setPlanningId, setError, setSprints, load: loadProjects });

  const handleSelect = async (p: ProjectData) => {
    setSelected(p);
    const res = await fetch(`/api/harness/projects/${p.id}/sprints`);
    if (res.ok) setSprints((await res.json()) as SprintData[]);
    else setSprints([]);
  };

  const handleDelete = async (projectId: string) => {
    await fetch(`/api/harness/projects/${projectId}`, { method: 'DELETE' });
    if (selected?.id === projectId) {
      setSelected(null);
      setSprints([]);
    }
    await loadProjects();
  };

  return (
    <div className="flex h-full gap-6">
      <ProjectListPanel
        form={form}
        setForm={setForm}
        creating={creating}
        error={error}
        projects={projects}
        selected={selected}
        planning={planning}
        onCreate={handleCreate}
        onSelect={(p) => {
          void handleSelect(p);
        }}
        onPlan={handlePlan}
        onDelete={(id) => {
          void handleDelete(id);
        }}
      />
      <SprintPanel selected={selected} sprints={sprints} />
    </div>
  );
}
