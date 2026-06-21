'use client';

import { useCallback, useEffect, useState } from 'react';

interface TaskData {
  id: string;
  name: string;
  description?: string;
  cronExpression: string;
  timezone: string;
  prompt: string;
  agentId?: string;
  enabled: boolean;
  lastRunAt?: string;
  nextRunAt?: string;
  tags: string[];
  createdAt: string;
}

interface NewTaskForm {
  name: string;
  cronExpression: string;
  prompt: string;
  description: string;
}

const EMPTY_FORM: NewTaskForm = { name: '', cronExpression: '', prompt: '', description: '' };

export function SchedulerView() {
  const [tasks, setTasks] = useState<TaskData[]>([]);
  const [form, setForm] = useState<NewTaskForm>(EMPTY_FORM);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTasks = useCallback(async () => {
    const res = await fetch('/api/scheduler/tasks', { credentials: 'include' });
    if (res.ok) {
      const data = (await res.json()) as { tasks: TaskData[] };
      setTasks(data.tasks ?? []);
    }
  }, []);

  useEffect(() => { void loadTasks(); }, [loadTasks]);

  const handleCreate = async () => {
    if (!form.name || !form.cronExpression || !form.prompt) {
      setError('Name, cron expression, and prompt are required.');
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const res = await fetch('/api/scheduler/tasks', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const d = (await res.json()) as { error?: string };
        setError(d.error ?? 'Failed to create task');
        return;
      }
      setForm(EMPTY_FORM);
      setShowForm(false);
      void loadTasks();
    } finally {
      setCreating(false);
    }
  };

  const handleToggle = async (task: TaskData) => {
    await fetch(`/api/scheduler/tasks/${task.id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: !task.enabled }),
    });
    void loadTasks();
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/scheduler/tasks/${id}`, { method: 'DELETE', credentials: 'include' });
    void loadTasks();
  };

  const handleRun = async (id: string) => {
    await fetch(`/api/scheduler/tasks/${id}/run`, { method: 'POST', credentials: 'include' });
    void loadTasks();
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Scheduler</h1>
          <p className="text-muted-foreground text-sm">Automate tasks with cron expressions.</p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium"
        >
          {showForm ? 'Cancel' : 'New Task'}
        </button>
      </div>

      {showForm && (
        <div className="bg-card space-y-4 rounded-lg border p-4">
          <h2 className="font-medium">Create Scheduled Task</h2>
          {error && <p className="text-destructive text-sm">{error}</p>}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-muted-foreground mb-1 block text-xs">Name *</label>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
                placeholder="Daily briefing"
              />
            </div>
            <div>
              <label className="text-muted-foreground mb-1 block text-xs">Cron expression *</label>
              <input
                value={form.cronExpression}
                onChange={(e) => setForm((f) => ({ ...f, cronExpression: e.target.value }))}
                className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm font-mono"
                placeholder="0 9 * * *"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-muted-foreground mb-1 block text-xs">Description</label>
              <input
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
                placeholder="Optional description"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-muted-foreground mb-1 block text-xs">Prompt *</label>
              <textarea
                value={form.prompt}
                onChange={(e) => setForm((f) => ({ ...f, prompt: e.target.value }))}
                rows={3}
                className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
                placeholder="Summarize the latest news and send me a briefing."
              />
            </div>
          </div>
          <button
            onClick={() => void handleCreate()}
            disabled={creating}
            className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {creating ? 'Creating…' : 'Create Task'}
          </button>
        </div>
      )}

      {tasks.length === 0 ? (
        <p className="text-muted-foreground py-12 text-center text-sm">No scheduled tasks yet.</p>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => (
            <div key={task.id} className="bg-card rounded-lg border p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`inline-block h-2 w-2 rounded-full ${task.enabled ? 'bg-green-500' : 'bg-gray-400'}`} />
                    <h3 className="truncate font-medium">{task.name}</h3>
                    <code className="bg-muted rounded px-1.5 py-0.5 text-xs font-mono">{task.cronExpression}</code>
                  </div>
                  {task.description && <p className="text-muted-foreground mt-1 text-sm">{task.description}</p>}
                  <p className="text-muted-foreground mt-1 line-clamp-1 text-xs">{task.prompt}</p>
                  <div className="text-muted-foreground mt-2 flex gap-3 text-xs">
                    {task.lastRunAt && <span>Last run: {new Date(task.lastRunAt).toLocaleString()}</span>}
                    {task.nextRunAt && <span>Next: {new Date(task.nextRunAt).toLocaleString()}</span>}
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button onClick={() => void handleRun(task.id)} className="text-muted-foreground hover:text-foreground text-xs transition-colors">run</button>
                  <button onClick={() => void handleToggle(task)} className="text-muted-foreground hover:text-foreground text-xs transition-colors">
                    {task.enabled ? 'pause' : 'enable'}
                  </button>
                  <button onClick={() => void handleDelete(task.id)} className="text-muted-foreground hover:text-destructive text-xs transition-colors">delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
