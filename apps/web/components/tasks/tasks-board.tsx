'use client';

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
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
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const activeTask = activeId ? tasks.find((t) => t.id === activeId) : null;

  function onDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function onDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;
    const targetStatus = String(over.id) as TaskStatus;
    if (STATUS_COLS.some((c) => c.key === targetStatus)) {
      void moveTask(String(active.id), targetStatus);
    }
  }

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
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
              statusKey={key}
              label={label}
              tasks={tasks.filter((t) => t.status === key)}
              onDelete={deleteTask}
            />
          ))}
        </div>
      </div>

      <DragOverlay>{activeTask ? <TaskCardBody task={activeTask} /> : null}</DragOverlay>
    </DndContext>
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
  statusKey,
  label,
  tasks,
  onDelete,
}: {
  statusKey: TaskStatus;
  label: string;
  tasks: Task[];
  onDelete: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: statusKey });
  return (
    <div ref={setNodeRef} className={`flex flex-col gap-2 rounded p-1 ${isOver ? 'bg-secondary/40' : ''}`}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{label}</h3>
        <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">{tasks.length}</span>
      </div>
      <div className="flex flex-col gap-2">
        {tasks.map((task) => (
          <DraggableTaskCard key={task.id} task={task} onDelete={onDelete} />
        ))}
      </div>
    </div>
  );
}

function DraggableTaskCard({ task, onDelete }: { task: Task; onDelete: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id });
  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0.4 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      <TaskCardBody task={task} onDelete={onDelete} />
    </div>
  );
}

/** Card body, reused by the drag overlay (no listeners there). */
function TaskCardBody({ task, onDelete }: { task: Task; onDelete?: (id: string) => void }) {
  return (
    <div className={`rounded border border-l-4 bg-card p-2 ${PRIORITY_COLORS[task.priority]}`}>
      <p className="text-sm font-medium">{task.title}</p>
      {onDelete && (
        <div className="mt-2 flex flex-wrap gap-1">
          <button
            onClick={() => onDelete(task.id)}
            className="rounded bg-destructive/10 px-1.5 py-0.5 text-xs text-destructive hover:bg-destructive/20"
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
