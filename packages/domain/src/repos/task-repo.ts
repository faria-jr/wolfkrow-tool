/**
 * Port de repositório de tasks do board (kanban).
 *
 * Distinto de `ScheduledTask`/`TaskRun` (scheduler): estes são tasks do
 * usuário (quadro kanban/calendar). Nomeados `TaskItem*` para evitar colisão
 * com `TaskStatus` do scheduled-task. Antes a rota fazia raw drizzle
 * (`db.select().from(tasks)`); agora o domínio define o contrato.
 */

export type TaskItemStatus = 'todo' | 'in_progress' | 'blocked' | 'done' | 'cancelled';
export type TaskItemCategory = 'work' | 'personal' | 'learning' | 'health' | 'finance' | 'other';
export type TaskItemPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface TaskItem {
 id: string;
 userId: string;
 title: string;
 description: string | null;
 status: TaskItemStatus;
 category: TaskItemCategory;
 priority: TaskItemPriority;
 dueDate: Date | null;
 completedAt: Date | null;
 tags: string[];
 createdAt: Date;
 updatedAt: Date;
}

export interface TaskItemCreateInput {
 userId: string;
 title: string;
 description?: string;
 status?: TaskItemStatus;
 category?: TaskItemCategory;
 priority?: TaskItemPriority;
 dueDate?: Date;
 tags?: string[];
}

export interface TaskItemUpdateInput {
 title?: string;
 description?: string | null;
 status?: TaskItemStatus;
 category?: TaskItemCategory;
 priority?: TaskItemPriority;
 dueDate?: Date | null;
 tags?: string[];
}

export interface TaskItemFilter {
 userId: string;
 status?: TaskItemStatus;
 category?: TaskItemCategory;
}

export interface TaskItemRepo {
 findMany(filter: TaskItemFilter): TaskItem[];
 create(input: TaskItemCreateInput): TaskItem;
 /** Atualiza campos; `completedAt` é derivado de `status` (done → now). */
 update(id: string, input: TaskItemUpdateInput): TaskItem | null;
 delete(id: string): void;
}
