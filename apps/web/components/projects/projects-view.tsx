'use client';

import type React from 'react';
import { useCallback, useEffect, useState } from 'react';

import { ProjectDetails } from './project-details';
import { type ProjectData } from './project-types';
import { ProjectsLeftPanel } from './projects-left-panel';

interface CreateFormValues {
  name: string;
  description: string;
  rootPath: string;
}

interface CreateProjectParams {
  setCreating: (b: boolean) => void;
  setError: (e: string | null) => void;
  resetForm: () => void;
  loadProjects: () => Promise<void>;
}

async function doCreateProject(
  e: React.FormEvent,
  values: CreateFormValues,
  p: CreateProjectParams
) {
  e.preventDefault();
  p.setCreating(true);
  p.setError(null);
  try {
    const body: Record<string, unknown> = { name: values.name };
    if (values.description) body.description = values.description;
    if (values.rootPath) body.rootPath = values.rootPath;
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Failed to create project');
    }
    p.resetForm();
    await p.loadProjects();
  } catch (err) {
    p.setError(err instanceof Error ? err.message : 'Error');
  } finally {
    p.setCreating(false);
  }
}

export function ProjectsView() {
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [selected, setSelected] = useState<ProjectData | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [rootPath, setRootPath] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);

  const loadProjects = useLoadProjects(setProjects, setError);
  useInitialLoad(loadProjects);
  const onSubmit = useSubmitHandler(
    { name, description, rootPath },
    { setCreating, setError, setName, setDescription, setRootPath, loadProjects }
  );
  const handleDelete = useDeleteHandler(selected, setSelected, loadProjects, setDetailError);
  const handleArchiveToggle = useArchiveToggle(setSelected, loadProjects, setDetailError);

  return (
    <div className="flex h-full gap-4 p-4">
      <ProjectsLeftPanel
        name={name}
        setName={setName}
        description={description}
        setDescription={setDescription}
        rootPath={rootPath}
        setRootPath={setRootPath}
        creating={creating}
        error={error}
        projects={projects}
        selected={selected}
        onSubmit={onSubmit}
        onSelect={setSelected}
      />
      {selected ? (
        <ProjectDetails
          project={selected}
          onDelete={handleDelete}
          onArchiveToggle={handleArchiveToggle}
          error={detailError}
        />
      ) : (
        <EmptyState />
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="text-muted-foreground flex flex-1 items-center justify-center text-sm">
      Select a project or create a new one.
    </div>
  );
}

function useSubmitHandler(
  values: CreateFormValues,
  setters: {
    setCreating: (b: boolean) => void;
    setError: (e: string | null) => void;
    setName: (v: string) => void;
    setDescription: (v: string) => void;
    setRootPath: (v: string) => void;
    loadProjects: () => Promise<void>;
  }
) {
  return useCallback(
    (e: React.FormEvent) =>
      void doCreateProject(e, values, {
        setCreating: setters.setCreating,
        setError: setters.setError,
        resetForm: () => {
          setters.setName('');
          setters.setDescription('');
          setters.setRootPath('');
        },
        loadProjects: setters.loadProjects,
      }),
    [values, setters]
  );
}

function useLoadProjects(
  setProjects: (p: ProjectData[]) => void,
  setError: (e: string | null) => void
) {
  return useCallback(async () => {
    try {
      const res = await fetch('/api/projects');
      if (!res.ok) throw new Error('Failed to load projects');
      setProjects((await res.json()) as ProjectData[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    }
  }, [setProjects, setError]);
}

function useInitialLoad(load: () => Promise<void>) {
  useEffect(() => {
    void load();
  }, [load]);
}

function useDeleteHandler(
  selected: ProjectData | null,
  setSelected: (p: ProjectData | null) => void,
  loadProjects: () => Promise<void>,
  setError: (e: string | null) => void
) {
  return useCallback(
    async (id: string) => {
      setError(null);
      try {
        const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' });
        if (!res.ok && res.status !== 204) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Failed to delete');
        }
        if (selected?.id === id) setSelected(null);
        await loadProjects();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error');
      }
    },
    [selected, setSelected, loadProjects, setError]
  );
}

function useArchiveToggle(
  setSelected: (p: ProjectData | null) => void,
  loadProjects: () => Promise<void>,
  setError: (e: string | null) => void
) {
  return useCallback(
    async (project: ProjectData) => {
      setError(null);
      const status = project.status === 'archived' ? 'active' : 'archived';
      try {
        const res = await fetch(`/api/projects/${project.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Failed to update');
        }
        setSelected((await res.json()) as ProjectData);
        await loadProjects();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error');
      }
    },
    [setSelected, loadProjects, setError]
  );
}
