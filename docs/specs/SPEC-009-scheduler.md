# SPEC-009: Scheduler

**Status**: 📝 Draft
**Camada**: Worker
**Prioridade**: P1 (importante)

---

## 1. Visão Geral

Cron-based scheduler com review queue. User cria tasks com cron expression, Worker executa em background, resultado fica em queue para user revisar.

### User Stories

- US-1: "Rodar code review toda segunda às 9h"
- US-2: "Daily briefing todo dia às 8h"
- US-3: "Revisar resultado antes de aceitar"

---

## 2. Database Schema

```typescript
export const scheduledTasks = sqliteTable('scheduled_tasks', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  cronExpression: text('cron_expression').notNull(),
  timezone: text('timezone').default('UTC'),
  prompt: text('prompt').notNull(), // chat prompt for agent
  agentId: text('agent_id'),
  enabled: integer('enabled', { mode: 'boolean' }).default(true),
  lastRunAt: integer('last_run_at', { mode: 'timestamp' }),
  nextRunAt: integer('next_run_at', { mode: 'timestamp' }),
  config: text('config', { mode: 'json' }).$type<TaskConfig>().default({}),
  tags: text('tags', { mode: 'json' }).$type<string[]>().default([]),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export const taskRuns = sqliteTable('task_runs', {
  id: text('id').primaryKey(),
  taskId: text('task_id')
    .notNull()
    .references(() => scheduledTasks.id, { onDelete: 'cascade' }),
  status: text('status', {
    enum: ['pending', 'running', 'completed', 'failed', 'awaiting_review', 'validated', 'rejected'],
  }).notNull(),
  startedAt: integer('started_at', { mode: 'timestamp' }),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
  output: text('output', { mode: 'json' }),
  error: text('error'),
  reviewNote: text('review_note'),
  reviewedAt: integer('reviewed_at', { mode: 'timestamp' }),
  metrics: text('metrics', { mode: 'json' }).$type<TaskRunMetrics>().default({}),
});
```

---

## 3. Scheduler Engine

```typescript
// apps/worker/src/scheduler/runner.ts
import cronParser from 'cron-parser';

export class SchedulerRunner {
  private timers = new Map<string, NodeJS.Timeout>();

  async start(): Promise<void> {
    const tasks = await this.taskRepo.list({ enabled: true });

    for (const task of tasks) {
      this.scheduleTask(task);
    }
  }

  private scheduleTask(task: ScheduledTask): void {
    if (this.timers.has(task.id)) {
      clearTimeout(this.timers.get(task.id)!);
    }

    const interval = cronParser.parseExpression(task.cronExpression, {
      tz: task.timezone,
    });

    const next = interval.next().toDate();
    const delay = next.getTime() - Date.now();

    const timer = setTimeout(() => {
      this.executeTask(task);
      this.scheduleTask(task); // Reschedule
    }, delay);

    this.timers.set(task.id, timer);
  }

  private async executeTask(task: ScheduledTask): Promise<void> {
    const run = await this.runRepo.create({
      taskId: task.id,
      status: 'running',
      startedAt: new Date(),
    });

    try {
      // Execute via SendMessage use-case
      const useCase = container.get(SendMessage);

      const session = await this.sessionRepo.createForTask(task);

      const chunks: StreamChunk[] = [];
      for await (const chunk of useCase.execute({
        sessionId: session.id,
        agentId: task.agentId,
        content: task.prompt,
      })) {
        chunks.push(chunk);
      }

      // Compile output
      const output = this.compileOutput(chunks);

      await this.runRepo.update(run.id, {
        status: 'awaiting_review',
        completedAt: new Date(),
        output,
        metrics: this.collectMetrics(chunks),
      });

      this.events.publish(new TaskRunCompletedEvent(run.id, task.id));
    } catch (error) {
      await this.runRepo.update(run.id, {
        status: 'failed',
        error: String(error),
        completedAt: new Date(),
      });
    }
  }

  async reviewRun(runId: string, decision: 'validated' | 'rejected', note?: string): Promise<void> {
    await this.runRepo.update(runId, {
      status: decision,
      reviewNote: note,
      reviewedAt: new Date(),
    });
  }

  stop(): void {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
  }
}
```

---

## 4. UI

### SchedulerPage

```tsx
'use client';
export function SchedulerPage() {
  const { data: tasks } = useSchedulerTasks();
  const { data: pendingCount } = usePendingReviewCount();

  return (
    <Tabs>
      <TabsList>
        <TabsTrigger value="tasks">Tasks ({tasks?.length})</TabsTrigger>
        <TabsTrigger value="runs">Runs</TabsTrigger>
        <TabsTrigger value="review">Review Queue ({pendingCount})</TabsTrigger>
        <TabsTrigger value="calendar">Calendar</TabsTrigger>
      </TabsList>

      <TabsContent value="tasks">
        <TaskList />
      </TabsContent>

      <TabsContent value="review">
        <ReviewQueue />
      </TabsContent>

      <TabsContent value="calendar">
        <CalendarView />
      </TabsContent>
    </Tabs>
  );
}
```

---

## 5. Testes

- Cron parsing edge cases
- Task execution happy path
- Task failure handling
- Review queue flow
- Pause/resume
- Timezone handling
