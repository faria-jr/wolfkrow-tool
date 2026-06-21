'use client';

import { useCallback, useEffect, useState } from 'react';

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

interface NewProjectForm {
  name: string;
  specPath: string;
  description: string;
  maxRoundsPerFeature: number;
}

const EMPTY_FORM: NewProjectForm = { name: '', specPath: '', description: '', maxRoundsPerFeature: 5 };
const USER_ID = 'user-1';

function statusColor(status: string): string {
  const map: Record<string, string> = {
    planning: 'bg-yellow-100 text-yellow-800',
    ready: 'bg-blue-100 text-blue-800',
    running: 'bg-purple-100 text-purple-800',
    completed: 'bg-green-100 text-green-800',
    failed: 'bg-red-100 text-red-800',
    paused: 'bg-gray-100 text-gray-800',
  };
  return map[status] ?? 'bg-gray-100 text-gray-800';
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

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const res = await fetch('/api/harness/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, userId: USER_ID }),
      });
      if (!res.ok) throw new Error('Failed to create project');
      setForm(EMPTY_FORM);
      await loadProjects();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setCreating(false);
    }
  };

  const handleSelect = async (p: ProjectData) => {
    setSelected(p);
    const res = await fetch(`/api/harness/projects/${p.id}/sprints`);
    if (res.ok) setSprints(await res.json() as SprintData[]);
    else setSprints([]);
  };

  const handlePlan = async (projectId: string) => {
    setPlanningId(projectId);
    setError(null);
    try {
      const res = await fetch(`/api/harness/projects/${projectId}/plan`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      if (!res.ok) throw new Error('Planning failed');
      const result = await res.json() as SprintData[];
      setSprints(result);
      await loadProjects();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setPlanningId(null);
    }
  };

  const handleDelete = async (projectId: string) => {
    await fetch(`/api/harness/projects/${projectId}?userId=${USER_ID}`, { method: 'DELETE' });
    if (selected?.id === projectId) { setSelected(null); setSprints([]); }
    await loadProjects();
  };

  return (
    <div className="flex h-full gap-6 p-6">
      {/* Left: project list + create form */}
      <div className="w-80 flex-shrink-0 space-y-4">
        <h2 className="text-lg font-semibold">Harness Projects</h2>

        <form onSubmit={(e) => { void handleCreate(e); }} className="space-y-2 rounded border p-3">
          <input
            className="w-full rounded border px-2 py-1 text-sm"
            placeholder="Project name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
          <input
            className="w-full rounded border px-2 py-1 text-sm"
            placeholder="Spec path (e.g. /docs/spec.md)"
            value={form.specPath}
            onChange={(e) => setForm({ ...form, specPath: e.target.value })}
            required
          />
          <input
            className="w-full rounded border px-2 py-1 text-sm"
            placeholder="Description (optional)"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <div className="flex items-center gap-2 text-sm">
            <label>Max rounds:</label>
            <input
              type="number"
              min={1}
              max={20}
              className="w-16 rounded border px-2 py-1"
              value={form.maxRoundsPerFeature}
              onChange={(e) => setForm({ ...form, maxRoundsPerFeature: Number(e.target.value) })}
            />
          </div>
          <button
            type="submit"
            disabled={creating}
            className="w-full rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {creating ? 'Creating…' : 'Create Project'}
          </button>
        </form>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <ul className="space-y-2">
          {projects.map((p) => (
            <li
              key={p.id}
              className={`cursor-pointer rounded border p-3 ${selected?.id === p.id ? 'border-blue-500 bg-blue-50' : 'hover:bg-gray-50'}`}
              onClick={() => { void handleSelect(p); }}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-sm">{p.name}</p>
                  {p.description && <p className="text-xs text-gray-500">{p.description}</p>}
                </div>
                <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${statusColor(p.status)}`}>{p.status}</span>
              </div>
              <div className="mt-2 flex gap-2">
                <button
                  onClick={(e) => { e.stopPropagation(); void handlePlan(p.id); }}
                  disabled={planning === p.id}
                  className="rounded bg-purple-600 px-2 py-1 text-xs text-white hover:bg-purple-700 disabled:opacity-50"
                >
                  {planning === p.id ? 'Planning…' : 'Plan Sprints'}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); void handleDelete(p.id); }}
                  className="rounded border border-red-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Right: sprint details */}
      <div className="flex-1 overflow-auto">
        {selected ? (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">{selected.name}</h2>
              <p className="text-sm text-gray-500">Status: <strong>{selected.status}</strong> · Tokens: {selected.metrics.totalTokens} · Features passed: {selected.metrics.featuresPassed}/{selected.metrics.featuresTotal}</p>
            </div>
            {sprints.length === 0 ? (
              <p className="text-sm text-gray-500">No sprints yet. Click "Plan Sprints" to generate them.</p>
            ) : (
              sprints.map((sprint) => (
                <div key={sprint.id} className="rounded border p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium">Sprint {sprint.number}: {sprint.name}</h3>
                    <span className={`rounded px-2 py-0.5 text-xs ${statusColor(sprint.status)}`}>{sprint.status}</span>
                  </div>
                  {sprint.description && <p className="mt-1 text-sm text-gray-600">{sprint.description}</p>}
                  <div className="mt-3 space-y-2">
                    {sprint.features.map((f, i) => (
                      <div key={i} className="rounded bg-gray-50 p-3">
                        <p className="font-medium text-sm">{f.name}</p>
                        <p className="text-xs text-gray-600">{f.description}</p>
                        {f.acceptanceCriteria.length > 0 && (
                          <ul className="mt-1 list-disc list-inside text-xs text-gray-500">
                            {f.acceptanceCriteria.map((c, j) => <li key={j}>{c}</li>)}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-gray-400">
            Select a project to view sprints
          </div>
        )}
      </div>
    </div>
  );
}
