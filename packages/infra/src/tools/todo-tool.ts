import { ToolResult } from '@wolfkrow/domain';
import type { ToolExecutionContext, ToolExecutor } from '@wolfkrow/domain';

type TodoItem = { id: string; content: string; done: boolean };

const store = new Map<string, TodoItem[]>();

export class TodoTool implements ToolExecutor {
  readonly name = 'todo';
  readonly description = 'Manage a simple in-session todo list.';
  readonly inputSchema = {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['list', 'add', 'complete', 'remove'] },
      content: { type: 'string', description: 'Todo content (add)' },
      id: { type: 'string', description: 'Todo id (complete/remove)' },
    },
    required: ['operation'],
  };

  async execute(input: Record<string, unknown>, ctx: ToolExecutionContext): Promise<ToolResult> {
    const callId = `todo-${Date.now()}`;
    const op = String(input['operation'] ?? '');
    const key = ctx.agentId ?? ctx.userId;
    const todos = store.get(key) ?? [];
    switch (op) {
      case 'list': return this.handleList(callId, key, todos);
      case 'add': return this.handleAdd(input, callId, key, todos);
      case 'complete': return this.handleComplete(input, callId, key, todos);
      case 'remove': return this.handleRemove(input, callId, key, todos);
      default: return ToolResult.error(callId, `Unknown operation: ${op}`);
    }
  }

  private handleList(callId: string, key: string, todos: TodoItem[]): ToolResult {
    store.set(key, todos);
    return ToolResult.ok(callId, JSON.stringify(todos, null, 2));
  }

  private handleAdd(input: Record<string, unknown>, callId: string, key: string, todos: TodoItem[]): ToolResult {
    const content = String(input['content'] ?? '');
    if (!content) return ToolResult.error(callId, 'content is required');
    const item: TodoItem = { id: `td-${Date.now()}`, content, done: false };
    todos.push(item);
    store.set(key, todos);
    return ToolResult.ok(callId, JSON.stringify(item));
  }

  private handleComplete(input: Record<string, unknown>, callId: string, key: string, todos: TodoItem[]): ToolResult {
    const id = String(input['id'] ?? '');
    const item = todos.find((t) => t.id === id);
    if (!item) return ToolResult.error(callId, `Todo ${id} not found`);
    item.done = true;
    store.set(key, todos);
    return ToolResult.ok(callId, JSON.stringify(item));
  }

  private handleRemove(input: Record<string, unknown>, callId: string, key: string, todos: TodoItem[]): ToolResult {
    const id = String(input['id'] ?? '');
    const idx = todos.findIndex((t) => t.id === id);
    if (idx === -1) return ToolResult.error(callId, `Todo ${id} not found`);
    todos.splice(idx, 1);
    store.set(key, todos);
    return ToolResult.ok(callId, `Removed ${id}`);
  }
}
