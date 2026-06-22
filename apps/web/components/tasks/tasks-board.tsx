'use client';

import { useCallback, useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type TaskStatus = 'todo' | 'in_progress' | 'blocked' | 'done' | 'cancelled';

interface Task {
  id: string;
  title: string;
  description?: string | null;
  status: TaskStatus;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: string;
  dueDate?: string | null;
  tags: string[];
}

const STATUS_COLS: { key: TaskStatus; label: string }[] = [
  { key: 'todo', label: 'Todo' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'blocked', label: 'Blocked' },
  { key: 'done', label: 'Done' },
];

const PRIORITY_COLORS = {
  low: 'border-l-gray-300',
  medium: 'border-l-blue-400',
  high: 'border-l-orange-400',
  urgent: 'border-l-red-500',
};

export function TasksBoard() {
  const { tasks, createTask, moveTask, deleteTask } = useTasks();
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      {showForm ? (
        <NewTaskForm onCreated={() => setShowForm(false)} onCreate={createTask} onCancel={() => setShowForm(false)} />
      ) : (
        <Button onClick={() => setShowForm(true)} className="w-fit">New Task</Button>
      )}

      <div className="grid grid-cols-4 gap-4">
        {STATUS_COLS.map(({ key, label }) => (
          <TaskColumn
            key={key}
            label={label}
            tasks={tasks.filter((t) => t.status === key)}
            onMove={moveTask}
            onDelete={deleteTask}
          />
        ))}
      </div>
    </div>
  );
}

function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);

  const load = useCallback(async () => {
    const res = await fetch('/api/tasks');
    if (res.ok) {
      const d = (await res.json()) as { tasks: Task[] };
      setTasks(d.tasks);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const createTask = useCallback(async (title: string) => {
    await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    });
    await load();
  }, [load]);

  const moveTask = useCallback(async (id: string, status: TaskStatus) => {
    await fetch(`/api/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    await load();
  }, [load]);

  const deleteTask = useCallback(async (id: string) => {
    await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
    await load();
  }, [load]);

  return { tasks, createTask, moveTask, deleteTask };
}

function NewTaskForm({
  onCreate,
  onCreated,
  onCancel,
}: {
  onCreate: (title: string) => Promise<void>;
  onCreated: () => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!title.trim()) return;
    setSaving(true);
    await onCreate(title);
    setTitle('');
    setSaving(false);
    onCreated();
  }

  return (
    <div className="flex items-center gap-2">
      <Input
        placeholder="Task title…"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') void submit(); }}
        autoFocus
        className="flex-1"
      />
      <Button onClick={() => void submit()} disabled={saving || !title.trim()}>Add</Button>
      <Button variant="outline" onClick={onCancel}>Cancel</Button>
    </div>
  );
}

function TaskColumn({
  label,
  tasks,
  onMove,
  onDelete,
}: {
  label: string;
  tasks: Task[];
  onMove: (id: string, status: TaskStatus) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{label}</h3>
        <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">{tasks.length}</span>
      </div>
      <div className="flex flex-col gap-2">
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} onMove={onMove} onDelete={onDelete} />
        ))}
      </div>
    </div>
  );
}

function TaskCard({
  task,
  onMove,
  onDelete,
}: {
  task: Task;
  onMove: (id: string, status: TaskStatus) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className={`rounded border border-l-4 bg-card p-2 ${PRIORITY_COLORS[task.priority]}`}>
      <p className="text-sm font-medium">{task.title}</p>
      <div className="mt-2 flex flex-wrap gap-1">
        {STATUS_COLS.filter((s) => s.key !== task.status).map((s) => (
          <button
            key={s.key}
            onClick={() => onMove(task.id, s.key)}
            className="rounded bg-secondary px-1.5 py-0.5 text-[10px] hover:bg-secondary/80"
          >
            → {s.label}
          </button>
        ))}
        <button
          onClick={() => onDelete(task.id)}
          className="rounded bg-destructive/10 px-1.5 py-0.5 text-[10px] text-destructive hover:bg-destructive/20"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
