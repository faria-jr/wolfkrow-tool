'use client';

import { useCallback, useEffect, useState } from 'react';

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

const USER_ID = 'user-1';

const STAGE_ORDER = ['discovery', 'spec_build', 'spec_validate', 'approval', 'implementation', 'completed'];
const STAGE_LABEL: Record<string, string> = {
  discovery: 'Discovery',
  spec_build: 'Spec Build',
  spec_validate: 'Spec Validate',
  approval: 'Approval',
  implementation: 'Implementation',
  completed: 'Completed',
};

function stageIndex(s: string) { return STAGE_ORDER.indexOf(s); }

function statusBadge(status: string): string {
  const m: Record<string, string> = {
    running: 'bg-blue-100 text-blue-800',
    paused: 'bg-yellow-100 text-yellow-800',
    awaiting_approval: 'bg-orange-100 text-orange-800',
    completed: 'bg-green-100 text-green-800',
    failed: 'bg-red-100 text-red-800',
    cancelled: 'bg-gray-100 text-gray-800',
    in_progress: 'bg-purple-100 text-purple-800',
    pending: 'bg-gray-100 text-gray-600',
    awaiting_user: 'bg-orange-100 text-orange-700',
    skipped: 'bg-gray-100 text-gray-400',
  };
  return m[status] ?? 'bg-gray-100 text-gray-600';
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
    const res = await fetch(`/api/pipeline/projects?userId=${USER_ID}`);
    if (res.ok) setProjects(await res.json() as ProjectData[]);
  }, []);

  const loadPhases = useCallback(async (projectId: string) => {
    const res = await fetch(`/api/pipeline/projects/${projectId}/phases`);
    if (res.ok) setPhases(await res.json() as PhaseData[]);
  }, []);

  useEffect(() => { void loadProjects(); }, [loadProjects]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const res = await fetch('/api/pipeline/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: USER_ID, name, description }),
      });
      if (!res.ok) throw new Error('Failed to create');
      setName('');
      setDescription('');
      await loadProjects();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setCreating(false);
    }
  };

  const handleSelect = async (p: ProjectData) => {
    setSelected(p);
    setPhaseOutput({});
    await loadPhases(p.id);
  };

  const handleRunPhase = async (projectId: string, stage: string) => {
    setRunningPhase(stage);
    setError(null);
    try {
      // Start phase
      const startRes = await fetch(`/api/pipeline/projects/${projectId}/phases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage }),
      });
      if (!startRes.ok) throw new Error('Failed to start phase');
      const phaseData = await startRes.json() as PhaseData;

      // Run AI on phase
      const runRes = await fetch(`/api/pipeline/projects/${projectId}/phases/${phaseData.id}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      if (!runRes.ok) throw new Error('AI execution failed');
      const runData = await runRes.json() as { output: string; project: ProjectData };
      setPhaseOutput((prev) => ({ ...prev, [stage]: runData.output }));
      setSelected(runData.project);
      await loadPhases(projectId);
      await loadProjects();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setRunningPhase(null);
    }
  };

  const handleApprove = async (projectId: string, phaseId: string, approved: boolean) => {
    setError(null);
    try {
      await fetch(`/api/pipeline/projects/${projectId}/phases/${phaseId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approved }),
      });
      const updated = await fetch(`/api/pipeline/projects/${projectId}`);
      if (updated.ok) setSelected(await updated.json() as ProjectData);
      await loadPhases(projectId);
      await loadProjects();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    }
  };

  const handleDelete = async (projectId: string) => {
    await fetch(`/api/pipeline/projects/${projectId}?userId=${USER_ID}`, { method: 'DELETE' });
    if (selected?.id === projectId) { setSelected(null); setPhases([]); }
    await loadProjects();
  };

  const currentStageIdx = selected ? stageIndex(selected.currentStage) : -1;

  return (
    <div className="flex h-full gap-6 p-6">
      {/* Left panel */}
      <div className="w-72 flex-shrink-0 space-y-4">
        <h2 className="text-lg font-semibold">Pipeline Projects</h2>

        <form onSubmit={(e) => { void handleCreate(e); }} className="space-y-2 rounded border p-3">
          <input
            className="w-full rounded border px-2 py-1 text-sm"
            placeholder="Project name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <textarea
            className="w-full rounded border px-2 py-1 text-sm"
            placeholder="Description (optional)"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <button type="submit" disabled={creating} className="w-full rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50">
            {creating ? 'Creating…' : 'New Pipeline'}
          </button>
        </form>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <ul className="space-y-2">
          {projects.map((p) => (
            <li
              key={p.id}
              className={`cursor-pointer rounded border p-3 text-sm ${selected?.id === p.id ? 'border-blue-500 bg-blue-50' : 'hover:bg-gray-50'}`}
              onClick={() => { void handleSelect(p); }}
            >
              <div className="flex items-start justify-between">
                <span className="font-medium">{p.name}</span>
                <span className={`rounded px-1.5 py-0.5 text-xs ${statusBadge(p.status)}`}>{p.status}</span>
              </div>
              <p className="mt-0.5 text-xs text-gray-500">{STAGE_LABEL[p.currentStage] ?? p.currentStage}</p>
              <button
                onClick={(e) => { e.stopPropagation(); void handleDelete(p.id); }}
                className="mt-1 text-xs text-red-500 hover:text-red-700"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Right panel */}
      <div className="flex-1 overflow-auto">
        {selected ? (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold">{selected.name}</h2>
              {selected.description && <p className="text-sm text-gray-500">{selected.description}</p>}
              <p className="text-sm text-gray-500 mt-1">Tokens used: {selected.metrics.totalTokens} · Phases: {selected.metrics.phasesCompleted}</p>
            </div>

            {/* Stage timeline */}
            <div className="flex gap-1">
              {STAGE_ORDER.filter((s) => s !== 'completed').map((stage, i) => (
                <div
                  key={stage}
                  className={`flex-1 rounded px-2 py-1.5 text-center text-xs font-medium ${i < currentStageIdx ? 'bg-green-100 text-green-800' : i === currentStageIdx ? 'bg-blue-100 text-blue-800 ring-1 ring-blue-400' : 'bg-gray-100 text-gray-400'}`}
                >
                  {STAGE_LABEL[stage]}
                </div>
              ))}
            </div>

            {/* Phases list */}
            {STAGE_ORDER.filter((s) => s !== 'completed').map((stage) => {
              const phase = phases.find((p) => p.stage === stage);
              const stageIdx = stageIndex(stage);
              const isActive = stageIdx === currentStageIdx;
              const canRun = isActive && (!phase || phase.status === 'pending');
              const canApprove = stage === 'approval' && phase?.status === 'awaiting_user';
              const output = phaseOutput[stage];

              return (
                <div key={stage} className={`rounded border p-4 ${isActive ? 'border-blue-300' : ''}`}>
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium text-sm">{STAGE_LABEL[stage]}</h3>
                    <div className="flex items-center gap-2">
                      {phase && <span className={`rounded px-2 py-0.5 text-xs ${statusBadge(phase.status)}`}>{phase.status}</span>}
                      {canRun && (
                        <button
                          onClick={() => { void handleRunPhase(selected.id, stage); }}
                          disabled={runningPhase === stage}
                          className="rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700 disabled:opacity-50"
                        >
                          {runningPhase === stage ? 'Running AI…' : 'Run'}
                        </button>
                      )}
                      {canApprove && (
                        <div className="flex gap-1">
                          <button onClick={() => { void handleApprove(selected.id, phase.id, true); }} className="rounded bg-green-600 px-2 py-1 text-xs text-white hover:bg-green-700">Approve</button>
                          <button onClick={() => { void handleApprove(selected.id, phase.id, false); }} className="rounded bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700">Reject</button>
                        </div>
                      )}
                    </div>
                  </div>
                  {output && (
                    <pre className="mt-2 overflow-auto rounded bg-gray-50 p-2 text-xs max-h-48 whitespace-pre-wrap">{output}</pre>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-gray-400">
            Select a pipeline project to view phases
          </div>
        )}
      </div>
    </div>
  );
}
