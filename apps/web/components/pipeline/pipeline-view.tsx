'use client';

import type React from 'react';
import { useCallback, useEffect, useState } from 'react';

import {
  type PhaseData,
  type ProjectData,
  PipelineLeftPanel,
  PipelineRightPanel,
  stageIndex,
} from './pipeline-subcomponents';

interface CreateFormValues {
  name: string;
  description: string;
  projectPath: string;
}
interface CreatePipelineParams {
  setCreating: (b: boolean) => void;
  setError: (e: string | null) => void;
  setName: (s: string) => void;
  setDescription: (s: string) => void;
  setProjectPath: (s: string) => void;
  loadProjects: () => Promise<void>;
}
async function doCreatePipeline(
  e: React.FormEvent,
  values: CreateFormValues,
  p: CreatePipelineParams
) {
  e.preventDefault();
  p.setCreating(true);
  p.setError(null);
  try {
    const body: Record<string, unknown> = { name: values.name, description: values.description };
    if (values.projectPath) body.projectPath = values.projectPath;
    const res = await fetch('/api/pipeline/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Failed to create');
    }
    p.setName('');
    p.setDescription('');
    p.setProjectPath('');
    await p.loadProjects();
  } catch (err) {
    p.setError(err instanceof Error ? err.message : 'Error');
  } finally {
    p.setCreating(false);
  }
}

interface ApproveParams {
  setError: (e: string | null) => void;
  setSelected: (p: ProjectData) => void;
  loadPhases: (id: string) => Promise<void>;
  loadProjects: () => Promise<void>;
}
async function doApprove(projectId: string, phaseId: string, approved: boolean, p: ApproveParams) {
  p.setError(null);
  try {
    await fetch(`/api/pipeline/projects/${projectId}/phases/${phaseId}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approved }),
    });
    const updated = await fetch(`/api/pipeline/projects/${projectId}`);
    if (updated.ok) p.setSelected((await updated.json()) as ProjectData);
    await p.loadPhases(projectId);
    await p.loadProjects();
  } catch (err) {
    p.setError(err instanceof Error ? err.message : 'Error');
  }
}

export function PipelineView() {
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [selected, setSelected] = useState<ProjectData | null>(null);
  const [phases, setPhases] = useState<PhaseData[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [projectPath, setProjectPath] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadProjects = useCallback(async () => {
    const res = await fetch('/api/pipeline/projects');
    if (res.ok) setProjects((await res.json()) as ProjectData[]);
  }, []);

  const loadPhases = useCallback(async (projectId: string) => {
    const res = await fetch(`/api/pipeline/projects/${projectId}/phases`);
    if (res.ok) setPhases((await res.json()) as PhaseData[]);
  }, []);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  const handleCreate = (e: React.FormEvent) =>
    void doCreatePipeline(
      e,
      { name, description, projectPath },
      { setCreating, setError, setName, setDescription, setProjectPath, loadProjects }
    );

  const handleApprove = (id: string, phaseId: string, approved: boolean) =>
    void doApprove(id, phaseId, approved, { setError, setSelected, loadPhases, loadProjects });

  const handleSelect = async (p: ProjectData) => {
    setSelected(p);
    await loadPhases(p.id);
  };

  const handleDelete = async (projectId: string) => {
    await fetch(`/api/pipeline/projects/${projectId}`, { method: 'DELETE' });
    if (selected?.id === projectId) {
      setSelected(null);
      setPhases([]);
    }
    await loadProjects();
  };

  return (
    <div className="flex h-full gap-6">
      <PipelineLeftPanel
        name={name}
        setName={setName}
        description={description}
        setDescription={setDescription}
        projectPath={projectPath}
        setProjectPath={setProjectPath}
        creating={creating}
        error={error}
        projects={projects}
        selected={selected}
        onSubmit={handleCreate}
        onSelect={(p) => {
          void handleSelect(p);
        }}
        onDelete={(id) => {
          void handleDelete(id);
        }}
      />
      <PipelineRightPanel
        selected={selected}
        phases={phases}
        currentStageIdx={selected ? stageIndex(selected.currentStage) : -1}
        onApprove={handleApprove}
      />
    </div>
  );
}
