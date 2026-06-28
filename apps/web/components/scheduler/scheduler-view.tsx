'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

import {
  type PendingRun,
  type TaskData,
  type TaskFormValues,
  PendingReviewSection,
  SchedulerTaskList,
  TaskCreateForm,
} from './scheduler-subcomponents';

import { ConfirmDialog } from '@/components/chat/confirm-dialog';
import { PageHeader } from '@/components/common/page-header';
import { Button } from '@/components/ui/button';

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
    const res = await fetch('/api/scheduler/tasks', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(p.values),
    });
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
    const [t, r] = await Promise.all([
      fetch('/api/scheduler/tasks', { credentials: 'include' }),
      fetch('/api/scheduler/runs/pending-review', { credentials: 'include' }),
    ]);
    if (t.ok) {
      const data = (await t.json()) as { items?: TaskData[]; tasks?: TaskData[] };
      setTasks(data.items ?? data.tasks ?? []);
    }
    if (r.ok) setPendingRuns(((await r.json()) as { runs: PendingRun[] }).runs ?? []);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  return { tasks, pendingRuns, reload: load };
}

async function patchTask(id: string, body: object) {
  const res = await fetch(`/api/scheduler/tasks/${id}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.ok;
}

async function reviewRun(runId: string, verdict: 'validated' | 'rejected') {
  await fetch(`/api/scheduler/runs/${runId}/review`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ verdict }),
  });
}

async function doRunTask(id: string, reload: () => Promise<void>) {
  try {
    const res = await fetch(`/api/scheduler/tasks/${id}/run`, {
      method: 'POST',
      credentials: 'include',
    });
    if (!res.ok) {
      toast.error('Failed to start task');
      return;
    }
    toast.success('Task started');
    await reload();
  } catch {
    toast.error('Failed to start task');
  }
}

interface DeleteTaskParams {
  id: string;
  reload: () => Promise<void>;
  setDeletingId: (id: string | null) => void;
  clearPending: () => void;
}
async function doDeleteTask(p: DeleteTaskParams) {
  p.setDeletingId(p.id);
  p.clearPending();
  try {
    const res = await fetch(`/api/scheduler/tasks/${p.id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (!res.ok) {
      toast.error('Failed to delete task');
      return;
    }
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

  const handleCreate = useCallback(
    (values: TaskFormValues) => {
      void doCreateTask({ values, setError, setCreating, setShowForm, load: () => void reload() });
    },
    [reload]
  );
  const handleToggle = useCallback(
    async (task: TaskData) => {
      const ok = await patchTask(task.id, { enabled: !task.enabled });
      if (!ok) {
        toast.error('Failed to update task');
        return;
      }
      toast.success(task.enabled ? 'Task paused' : 'Task enabled');
      await reload();
    },
    [reload]
  );
  const handleRun = useCallback((id: string) => doRunTask(id, reload), [reload]);
  const performDelete = useCallback(
    (id: string) =>
      doDeleteTask({ id, reload, setDeletingId, clearPending: () => setPendingDeleteId(null) }),
    [reload]
  );

  return {
    creating,
    showForm,
    setShowForm,
    error,
    deletingId,
    pendingDeleteId,
    handleCreate,
    handleToggle,
    handleRun,
    performDelete,
    requestDelete: setPendingDeleteId,
    cancelDelete: () => setPendingDeleteId(null),
  };
}

export function SchedulerView() {
  const { tasks, pendingRuns, reload } = useSchedulerData();
  const a = useSchedulerActions(reload);
  const handleReview = (runId: string, verdict: 'validated' | 'rejected') =>
    void reviewRun(runId, verdict).then(() => void reload());

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <PageHeader
        title="Scheduler"
        description="Automate tasks with cron expressions."
        actions={
          <Button variant="default" onClick={() => a.setShowForm((v) => !v)}>
            {a.showForm ? 'Cancel' : 'New Task'}
          </Button>
        }
      />
      {a.showForm && (
        <TaskCreateForm creating={a.creating} error={a.error} onSubmit={a.handleCreate} />
      )}
      <PendingReviewSection runs={pendingRuns} onReview={(id, v) => void handleReview(id, v)} />
      <SchedulerTaskList
        tasks={tasks}
        deletingId={a.deletingId}
        onToggle={a.handleToggle}
        onRequestDelete={a.requestDelete}
        onRun={a.handleRun}
      />
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
