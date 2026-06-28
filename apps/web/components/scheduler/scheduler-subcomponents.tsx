'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { memo } from 'react';
import { type Control, useForm } from 'react-hook-form';
import { z } from 'zod';

import { EmptyState } from '@/components/common/empty-state';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export interface TaskData {
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

export interface PendingRun {
  id: string;
  taskId: string;
  status: string;
  output?: { content?: string };
  startedAt?: string;
}

export const taskSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  cronExpression: z.string().min(1, 'Cron expression is required'),
  prompt: z.string().min(1, 'Prompt is required'),
  description: z.string().optional(),
});
export type TaskFormValues = z.infer<typeof taskSchema>;
export const EMPTY_FORM: TaskFormValues = { name: '', cronExpression: '', prompt: '', description: '' };

interface CreateFormProps {
  creating: boolean;
  error: string | null;
  onSubmit: (values: TaskFormValues) => void;
}

function TaskCreateFormFields({ control }: { control: Control<TaskFormValues> }) {
  return (
    <>
      <FormField
        control={control}
        name="name"
        render={({ field }) => (
          <FormItem>
            <Label htmlFor="task-name">Name *</Label>
            <FormControl>
              <Input id="task-name" placeholder="Daily briefing" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name="cronExpression"
        render={({ field }) => (
          <FormItem>
            <Label htmlFor="task-cron">Cron expression *</Label>
            <FormControl>
              <Input id="task-cron" className="font-mono" placeholder="0 9 * * *" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name="description"
        render={({ field }) => (
          <FormItem className="sm:col-span-2">
            <Label htmlFor="task-description">Description</Label>
            <FormControl>
              <Input id="task-description" placeholder="Optional description" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name="prompt"
        render={({ field }) => (
          <FormItem className="sm:col-span-2">
            <Label htmlFor="task-prompt">Prompt *</Label>
            <FormControl>
              <Textarea
                id="task-prompt"
                rows={3}
                placeholder="Summarize the latest news and send me a briefing."
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  );
}

export function TaskCreateForm({ creating, error, onSubmit }: CreateFormProps) {
  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskSchema),
    defaultValues: EMPTY_FORM,
  });
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

interface TaskItemProps {
  task: TaskData;
  deleting: boolean;
  onToggle: (task: TaskData) => void;
  onRequestDelete: (id: string) => void;
  onRun: (id: string) => void;
}
const SchedulerTaskItem = memo(function SchedulerTaskItem({
  task,
  deleting,
  onToggle,
  onRequestDelete,
  onRun,
}: TaskItemProps) {
  return (
    <div className="bg-card rounded-lg border p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className={`inline-block h-2 w-2 rounded-full ${task.enabled ? 'bg-success' : 'bg-muted-foreground/50'}`}
            />
            <h3 className="truncate font-medium">{task.name}</h3>
            <code className="bg-muted rounded px-1.5 py-0.5 font-mono text-xs">
              {task.cronExpression}
            </code>
            {task.tags.includes('requires-review') && (
              <span className="bg-warning/15 text-warning rounded px-1.5 py-0.5 text-xs">
                review required
              </span>
            )}
          </div>
          {task.description && (
            <p className="text-muted-foreground mt-1 text-sm">{task.description}</p>
          )}
          <p className="text-muted-foreground mt-1 line-clamp-1 text-xs">{task.prompt}</p>
          <div className="text-muted-foreground mt-2 flex gap-3 text-xs">
            {task.lastRunAt && <span>Last run: {new Date(task.lastRunAt).toLocaleString()}</span>}
            {task.nextRunAt && <span>Next: {new Date(task.nextRunAt).toLocaleString()}</span>}
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            onClick={() => onRun(task.id)}
            className="text-muted-foreground hover:text-foreground text-xs transition-colors"
          >
            run
          </button>
          <button
            onClick={() => onToggle(task)}
            className="text-muted-foreground hover:text-foreground text-xs transition-colors"
          >
            {task.enabled ? 'pause' : 'enable'}
          </button>
          <button
            onClick={() => onRequestDelete(task.id)}
            disabled={deleting}
            className="text-muted-foreground hover:text-destructive text-xs transition-colors disabled:opacity-50"
          >
            {deleting ? 'deleting…' : 'delete'}
          </button>
        </div>
      </div>
    </div>
  );
});

interface PendingReviewProps {
  runs: PendingRun[];
  onReview: (id: string, verdict: 'validated' | 'rejected') => void;
}
export function PendingReviewSection({ runs, onReview }: PendingReviewProps) {
  if (runs.length === 0) return null;
  return (
    <div className="space-y-3">
      <h2 className="text-warning flex items-center gap-2 font-semibold">
        <span className="bg-warning inline-block h-2 w-2 rounded-full" />
        Pending Review ({runs.length})
      </h2>
      {runs.map((run) => (
        <div key={run.id} className="bg-card border-warning/30 rounded-lg border p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-muted-foreground text-xs">
                Run {run.id.slice(0, 8)} ·{' '}
                {run.startedAt ? new Date(run.startedAt).toLocaleString() : '—'}
              </p>
              {run.output?.content && (
                <pre className="bg-muted mt-2 max-h-32 overflow-auto whitespace-pre-wrap rounded p-2 text-xs">
                  {run.output.content}
                </pre>
              )}
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                onClick={() => onReview(run.id, 'validated')}
                className="bg-success text-success-foreground hover:bg-success/90 rounded px-3 py-1 text-xs"
              >
                Approve
              </button>
              <button
                onClick={() => onReview(run.id, 'rejected')}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded px-3 py-1 text-xs"
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

interface TaskListProps {
  tasks: TaskData[];
  deletingId: string | null;
  onToggle: (task: TaskData) => void;
  onRequestDelete: (id: string) => void;
  onRun: (id: string) => void;
}
export function SchedulerTaskList({ tasks, deletingId, onToggle, onRequestDelete, onRun }: TaskListProps) {
  if (tasks.length === 0) {
    return (
      <EmptyState
        title="No scheduled tasks yet"
        description="Automate tasks with cron expressions — create your first one."
      />
    );
  }
  return (
    <div className="space-y-3">
      {tasks.map((task) => (
        <SchedulerTaskItem
          key={task.id}
          task={task}
          deleting={deletingId === task.id}
          onToggle={onToggle}
          onRequestDelete={onRequestDelete}
          onRun={onRun}
        />
      ))}
    </div>
  );
}
