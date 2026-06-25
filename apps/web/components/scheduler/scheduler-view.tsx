'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { memo, useCallback, useEffect, useState } from 'react';
import { useForm, type Control } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { ConfirmDialog } from '@/components/chat/confirm-dialog';
import { EmptyState } from '@/components/common/empty-state';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

const taskSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  cronExpression: z.string().min(1, 'Cron expression is required'),
  prompt: z.string().min(1, 'Prompt is required'),
  description: z.string().optional(),
});
type TaskFormValues = z.infer<typeof taskSchema>;
const EMPTY_FORM: TaskFormValues = { name: '', cronExpression: '', prompt: '', description: '' };

interface CreateFormProps {
  creating: boolean;
  error: string | null;
  onSubmit: (values: TaskFormValues) => void;
}
function TaskCreateFormFields({ control }: { control: Control<TaskFormValues> }) {
  return (
    <>
      <FormField control={control} name="name" render={({ field }) => (
        <FormItem><Label htmlFor="task-name">Name *</Label><FormControl><Input id="task-name" placeholder="Daily briefing" {...field} /></FormControl><FormMessage /></FormItem>
      )} />
      <FormField control={control} name="cronExpression" render={({ field }) => (
        <FormItem><Label htmlFor="task-cron">Cron expression *</Label><FormControl><Input id="task-cron" className="font-mono" placeholder="0 9 * * *" {...field} /></FormControl><FormMessage /></FormItem>
      )} />
      <FormField control={control} name="description" render={({ field }) => (
        <FormItem className="sm:col-span-2"><Label htmlFor="task-description">Description</Label><FormControl><Input id="task-description" placeholder="Optional description" {...field} /></FormControl><FormMessage /></FormItem>
      )} />
      <FormField control={control} name="prompt" render={({ field }) => (
        <FormItem className="sm:col-span-2"><Label htmlFor="task-prompt">Prompt *</Label><FormControl><Textarea id="task-prompt" rows={3} placeholder="Summarize the latest news and send me a briefing." {...field} /></FormControl><FormMessage /></FormItem>
      )} />
    </>
  );
}
function TaskCreateForm({ creating, error, onSubmit }: CreateFormProps) {
  const form = useForm<TaskFormValues>({ resolver: zodResolver(taskSchema), defaultValues: EMPTY_FORM });
  return (
    <div className="bg-card space-y-4 rounded-lg border p-4">
      <h2 className="font-medium">Create Scheduled Task</h2>
      {error && <p className="text-destructive text-sm">{error}</p>}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-3 sm:grid-cols-2">
          <TaskCreateFormFields control={form.control} />
          <div className="sm:col-span-2">
            <Button type="submit" disabled={creating}>
              {creating ? 'Creating…' : 'Create Task'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}

interface TaskItemProps { task: TaskData; deleting: boolean; onToggle: (task: TaskData) => void; onRequestDelete: (id: string) => void; onRun: (id: string) => void; }
const SchedulerTaskItem = memo(function SchedulerTaskItem({ task, deleting, onToggle, onRequestDelete, onRun }: TaskItemProps) {
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
          <div className="text-muted-foreground mt-2 flex gap-3 text-xs">{task.lastRunAt && <span>Last run: {new Date(task.lastRunAt).toLocaleString()}</span>}{task.nextRunAt && <span>Next: {new Date(task.nextRunAt).toLocaleString()}</span>}</div>
        </div>
        <div className="flex shrink-0 gap-2">
          <button onClick={() => onRun(task.id)} className="text-muted-foreground hover:text-foreground text-xs transition-colors">run</button>
          <button onClick={() => onToggle(task)} className="text-muted-foreground hover:text-foreground text-xs transition-colors">{task.enabled ? 'pause' : 'enable'}</button>
          <button onClick={() => onRequestDelete(task.id)} disabled={deleting} className="text-muted-foreground hover:text-destructive text-xs transition-colors disabled:opacity-50">{deleting ? 'deleting…' : 'delete'}</button>
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
              {run.output?.content && <pre className="bg-muted mt-2 max-h-32 overflow-auto rounded p-2 text-xs whitespace-pre-wrap">{run.output.content}</pre>}
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

interface CreateParams {
  values: TaskFormValues;
  setError: (e: string | null) => void;
  setCreating: (b: boolean) => void;
  setShowForm: (b: boolean) => void;
  load: () => void;
}
async function doCreateTask(p: CreateParams) {
  p.setCreating(true);
  p.setError(null);
  try {
    const res = await fetch('/api/scheduler/tasks', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(p.values) });
    if (!res.ok) {
      const msg = ((await res.json()) as { error?: string }).error ?? 'Failed to create task';
      p.setError(msg);
      toast.error(msg);
      return;
    }
    toast.success('Task created');
    p.setShowForm(false);
    p.load();
  } catch {
    p.setError('Failed to create task');
    toast.error('Failed to create task');
  } finally {
    p.setCreating(false);
  }
}

function useSchedulerData() {
  const [tasks, setTasks] = useState<TaskData[]>([]);
  const [pendingRuns, setPendingRuns] = useState<PendingRun[]>([]);
  const load = useCallback(async () => {
    const [t, r] = await Promise.all([fetch('/api/scheduler/tasks', { credentials: 'include' }), fetch('/api/scheduler/runs/pending-review', { credentials: 'include' })]);
    if (t.ok) setTasks(((await t.json()) as { tasks: TaskData[] }).tasks ?? []);
    if (r.ok) setPendingRuns(((await r.json()) as { runs: PendingRun[] }).runs ?? []);
  }, []);
  useEffect(() => { void load(); }, [load]);
  return { tasks, pendingRuns, reload: load };
}

async function patchTask(id: string, body: object) {
  const res = await fetch(`/api/scheduler/tasks/${id}`, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return res.ok;
}

async function reviewRun(runId: string, verdict: 'validated' | 'rejected') {
  await fetch(`/api/scheduler/runs/${runId}/review`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ verdict }) });
}

async function doRunTask(id: string, reload: () => Promise<void>) {
  try {
    const res = await fetch(`/api/scheduler/tasks/${id}/run`, { method: 'POST', credentials: 'include' });
    if (!res.ok) { toast.error('Failed to start task'); return; }
    toast.success('Task started');
    await reload();
  } catch {
    toast.error('Failed to start task');
  }
}

interface DeleteTaskParams { id: string; reload: () => Promise<void>; setDeletingId: (id: string | null) => void; clearPending: () => void; }
async function doDeleteTask(p: DeleteTaskParams) {
  p.setDeletingId(p.id);
  p.clearPending();
  try {
    const res = await fetch(`/api/scheduler/tasks/${p.id}`, { method: 'DELETE', credentials: 'include' });
    if (!res.ok) { toast.error('Failed to delete task'); return; }
    toast.success('Task deleted');
    await p.reload();
  } catch {
    toast.error('Failed to delete task');
  } finally {
    p.setDeletingId(null);
  }
}

function useSchedulerActions(reload: () => Promise<void>) {
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const handleCreate = useCallback((values: TaskFormValues) => { void doCreateTask({ values, setError, setCreating, setShowForm, load: () => void reload() }); }, [reload]);
  const handleToggle = useCallback(async (task: TaskData) => {
    const ok = await patchTask(task.id, { enabled: !task.enabled });
    if (!ok) { toast.error('Failed to update task'); return; }
    toast.success(task.enabled ? 'Task paused' : 'Task enabled');
    await reload();
  }, [reload]);
  const handleRun = useCallback((id: string) => doRunTask(id, reload), [reload]);
  const performDelete = useCallback((id: string) => doDeleteTask({ id, reload, setDeletingId, clearPending: () => setPendingDeleteId(null) }), [reload]);

  return {
    creating, showForm, setShowForm, error, deletingId, pendingDeleteId,
    handleCreate, handleToggle, handleRun, performDelete,
    requestDelete: setPendingDeleteId,
    cancelDelete: () => setPendingDeleteId(null),
  };
}

interface TaskListProps {
  tasks: TaskData[];
  deletingId: string | null;
  onToggle: (task: TaskData) => void;
  onRequestDelete: (id: string) => void;
  onRun: (id: string) => void;
}
function SchedulerTaskList({ tasks, deletingId, onToggle, onRequestDelete, onRun }: TaskListProps) {
  if (tasks.length === 0) {
    return <EmptyState title="No scheduled tasks yet" description="Automate tasks with cron expressions — create your first one." />;
  }
  return (
    <div className="space-y-3">
      {tasks.map((task) => (
        <SchedulerTaskItem key={task.id} task={task} deleting={deletingId === task.id} onToggle={onToggle} onRequestDelete={onRequestDelete} onRun={onRun} />
      ))}
    </div>
  );
}

export function SchedulerView() {
  const { tasks, pendingRuns, reload } = useSchedulerData();
  const a = useSchedulerActions(reload);
  const handleReview = (runId: string, verdict: 'validated' | 'rejected') => void reviewRun(runId, verdict).then(() => void reload());

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Scheduler</h1>
          <p className="text-muted-foreground text-sm">Automate tasks with cron expressions.</p>
        </div>
        <Button variant="default" onClick={() => a.setShowForm((v) => !v)}>{a.showForm ? 'Cancel' : 'New Task'}</Button>
      </div>
      {a.showForm && <TaskCreateForm creating={a.creating} error={a.error} onSubmit={a.handleCreate} />}
      <PendingReviewSection runs={pendingRuns} onReview={(id, v) => void handleReview(id, v)} />
      <SchedulerTaskList tasks={tasks} deletingId={a.deletingId} onToggle={a.handleToggle} onRequestDelete={a.requestDelete} onRun={a.handleRun} />
      <ConfirmDialog
        open={a.pendingDeleteId !== null}
        title="Delete task"
        description="Delete this scheduled task? This cannot be undone."
        confirmLabel="Delete"
        onConfirm={() => a.pendingDeleteId && void a.performDelete(a.pendingDeleteId)}
        onCancel={a.cancelDelete}
      />
    </div>
  );
}
