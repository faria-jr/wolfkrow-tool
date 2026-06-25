'use client';

import { memo, useCallback, useEffect, useState } from 'react';

import { EmptyState } from '@/components/common/empty-state';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

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

interface PendingRun {
  id: string;
  taskId: string;
  status: string;
  output?: { content?: string };
  startedAt?: string;
}

interface NewTaskForm { name: string; cronExpression: string; prompt: string; description: string; }

const EMPTY_FORM: NewTaskForm = { name: '', cronExpression: '', prompt: '', description: '' };

interface CreateFormProps { form: NewTaskForm; setForm: (f: NewTaskForm) => void; creating: boolean; error: string | null; onSubmit: () => void; }
function TaskCreateForm({ form, setForm, creating, error, onSubmit }: CreateFormProps) {
  const set = (key: keyof NewTaskForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm({ ...form, [key]: e.target.value });
  return (
    <div className="bg-card space-y-4 rounded-lg border p-4">
      <h2 className="font-medium">Create Scheduled Task</h2>
      {error && <p className="text-destructive text-sm">{error}</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="text-muted-foreground mb-1 block text-xs">Name *</label>
          <Input value={form.name} onChange={set('name')} placeholder="Daily briefing" />
        </div>
        <div>
          <label className="text-muted-foreground mb-1 block text-xs">Cron expression *</label>
          <Input value={form.cronExpression} onChange={set('cronExpression')} className="font-mono" placeholder="0 9 * * *" />
        </div>
        <div className="sm:col-span-2">
          <label className="text-muted-foreground mb-1 block text-xs">Description</label>
          <Input value={form.description} onChange={set('description')} placeholder="Optional description" />
        </div>
        <div className="sm:col-span-2">
          <label className="text-muted-foreground mb-1 block text-xs">Prompt *</label>
          <Textarea value={form.prompt} onChange={set('prompt')} rows={3} placeholder="Summarize the latest news and send me a briefing." />
        </div>
      </div>
      <button onClick={onSubmit} disabled={creating} className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50">
        {creating ? 'Creating…' : 'Create Task'}
      </button>
    </div>
  );
}

interface TaskItemProps { task: TaskData; onToggle: (task: TaskData) => void; onDelete: (id: string) => void; onRun: (id: string) => void; }
const SchedulerTaskItem = memo(function SchedulerTaskItem({ task, onToggle, onDelete, onRun }: TaskItemProps) {
  return (
    <div className="bg-card rounded-lg border p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={`inline-block h-2 w-2 rounded-full ${task.enabled ? 'bg-success' : 'bg-muted-foreground/50'}`} />
            <h3 className="truncate font-medium">{task.name}</h3>
            <code className="bg-muted rounded px-1.5 py-0.5 text-xs font-mono">{task.cronExpression}</code>
            {task.tags.includes('requires-review') && <span className="rounded bg-warning/15 px-1.5 py-0.5 text-xs text-warning">review required</span>}
          </div>
          {task.description && <p className="text-muted-foreground mt-1 text-sm">{task.description}</p>}
          <p className="text-muted-foreground mt-1 line-clamp-1 text-xs">{task.prompt}</p>
          <div className="text-muted-foreground mt-2 flex gap-3 text-xs">
            {task.lastRunAt && <span>Last run: {new Date(task.lastRunAt).toLocaleString()}</span>}
            {task.nextRunAt && <span>Next: {new Date(task.nextRunAt).toLocaleString()}</span>}
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <button onClick={() => onRun(task.id)} className="text-muted-foreground hover:text-foreground text-xs transition-colors">run</button>
          <button onClick={() => onToggle(task)} className="text-muted-foreground hover:text-foreground text-xs transition-colors">{task.enabled ? 'pause' : 'enable'}</button>
          <button onClick={() => onDelete(task.id)} className="text-muted-foreground hover:text-destructive text-xs transition-colors">delete</button>
        </div>
      </div>
    </div>
  );
});

interface PendingReviewProps { runs: PendingRun[]; onReview: (id: string, verdict: 'validated' | 'rejected') => void; }
function PendingReviewSection({ runs, onReview }: PendingReviewProps) {
  if (runs.length === 0) return null;
  return (
    <div className="space-y-3">
      <h2 className="flex items-center gap-2 font-semibold text-warning">
        <span className="inline-block h-2 w-2 rounded-full bg-warning" />
        Pending Review ({runs.length})
      </h2>
      {runs.map((run) => (
        <div key={run.id} className="bg-card rounded-lg border border-warning/30 p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-muted-foreground text-xs">Run {run.id.slice(0, 8)} · {run.startedAt ? new Date(run.startedAt).toLocaleString() : '—'}</p>
              {run.output?.content && (
                <pre className="bg-muted mt-2 max-h-32 overflow-auto rounded p-2 text-xs whitespace-pre-wrap">{run.output.content}</pre>
              )}
            </div>
            <div className="flex shrink-0 gap-2">
              <button onClick={() => onReview(run.id, 'validated')} className="rounded bg-success px-3 py-1 text-xs text-success-foreground hover:bg-success/90">Approve</button>
              <button onClick={() => onReview(run.id, 'rejected')} className="rounded bg-destructive px-3 py-1 text-xs text-destructive-foreground hover:bg-destructive/90">Reject</button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

interface CreateParams { form: NewTaskForm; setError: (e: string | null) => void; setCreating: (b: boolean) => void; setForm: (f: NewTaskForm) => void; setShowForm: (b: boolean) => void; load: () => void; }
async function doCreateTask(p: CreateParams) {
  if (!p.form.name || !p.form.cronExpression || !p.form.prompt) {
    p.setError('Name, cron expression, and prompt are required.');
    return;
  }
  p.setCreating(true);
  p.setError(null);
  try {
    const res = await fetch('/api/scheduler/tasks', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(p.form),
    });
    if (!res.ok) {
      const d = (await res.json()) as { error?: string };
      p.setError(d.error ?? 'Failed to create task');
      return;
    }
    p.setForm(EMPTY_FORM);
    p.setShowForm(false);
    p.load();
  } finally {
    p.setCreating(false);
  }
}

function useSchedulerData() {
  const [tasks, setTasks] = useState<TaskData[]>([]);
  const [pendingRuns, setPendingRuns] = useState<PendingRun[]>([]);
  const load = useCallback(async () => {
    const [t, r] = await Promise.all([
      fetch('/api/scheduler/tasks', { credentials: 'include' }),
      fetch('/api/scheduler/runs/pending-review', { credentials: 'include' }),
    ]);
    if (t.ok) setTasks(((await t.json()) as { tasks: TaskData[] }).tasks ?? []);
    if (r.ok) setPendingRuns(((await r.json()) as { runs: PendingRun[] }).runs ?? []);
  }, []);
  useEffect(() => { void load(); }, [load]);
  return { tasks, pendingRuns, reload: load };
}

async function patchTask(id: string, body: object) {
  await fetch(`/api/scheduler/tasks/${id}`, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}

async function reviewRun(runId: string, verdict: 'validated' | 'rejected') {
  await fetch(`/api/scheduler/runs/${runId}/review`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ verdict }) });
}

export function SchedulerView() {
  const { tasks, pendingRuns, reload } = useSchedulerData();
  const [form, setForm] = useState<NewTaskForm>(EMPTY_FORM);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = () => void doCreateTask({ form, setError, setCreating, setForm, setShowForm, load: () => void reload() });
  const handleToggle = useCallback((task: TaskData) => { void patchTask(task.id, { enabled: !task.enabled }).then(() => void reload()); }, [reload]);
  const handleDelete = useCallback((id: string) => { void fetch(`/api/scheduler/tasks/${id}`, { method: 'DELETE', credentials: 'include' }).then(() => void reload()); }, [reload]);
  const handleRun = useCallback((id: string) => { void fetch(`/api/scheduler/tasks/${id}/run`, { method: 'POST', credentials: 'include' }).then(() => void reload()); }, [reload]);
  const handleReview = (runId: string, verdict: 'validated' | 'rejected') => void reviewRun(runId, verdict).then(() => void reload());

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Scheduler</h1>
          <p className="text-muted-foreground text-sm">Automate tasks with cron expressions.</p>
        </div>
        <button onClick={() => setShowForm((v) => !v)} className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium">
          {showForm ? 'Cancel' : 'New Task'}
        </button>
      </div>
      {showForm && <TaskCreateForm form={form} setForm={setForm} creating={creating} error={error} onSubmit={handleCreate} />}
      <PendingReviewSection runs={pendingRuns} onReview={(id, v) => void handleReview(id, v)} />
      {tasks.length === 0 ? (
        <EmptyState title="No scheduled tasks yet" description="Automate tasks with cron expressions — create your first one." />
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => <SchedulerTaskItem key={task.id} task={task} onToggle={handleToggle} onDelete={handleDelete} onRun={handleRun} />)}
        </div>
      )}
    </div>
  );
}
