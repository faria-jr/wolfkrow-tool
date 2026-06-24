import { describe, expect, it, beforeEach } from 'vitest';

import { TodoTool } from '../todo-tool';

let ctx: { userId: string; agentId: string };

beforeEach(() => {
  ctx = { userId: 'u1', agentId: `agent-${Date.now()}-${Math.random().toString(36).slice(2)}` };
});

describe('TodoTool', () => {
  it('has correct metadata', () => {
    const tool = new TodoTool();
    expect(tool.name).toBe('todo');
    expect(tool.inputSchema.required).toContain('operation');
  });

  it('list returns empty when no todos exist', async () => {
    const tool = new TodoTool();
    const r = await tool.execute({ operation: 'list' }, ctx);
    expect(r.isError).toBe(false);
    expect(r.output).toBe('[]');
  });

  it('add then list returns the added todo', async () => {
    const tool = new TodoTool();
    const added = await tool.execute({ operation: 'add', content: 'task 1' }, ctx);
    expect(added.isError).toBe(false);
    const listed = await tool.execute({ operation: 'list' }, ctx);
    expect(listed.output).toContain('task 1');
  });

  it('add fails when content is missing', async () => {
    const tool = new TodoTool();
    const r = await tool.execute({ operation: 'add' }, ctx);
    expect(r.isError).toBe(true);
    expect(r.output).toMatch(/content is required/);
  });

  it('complete marks todo as done', async () => {
    const tool = new TodoTool();
    const added = await tool.execute({ operation: 'add', content: 'todo' }, ctx);
    const item = JSON.parse(added.output) as { id: string };
    const completed = await tool.execute({ operation: 'complete', id: item.id }, ctx);
    expect(completed.isError).toBe(false);
    const parsed = JSON.parse(completed.output) as { done: boolean };
    expect(parsed.done).toBe(true);
  });

  it('complete fails for unknown id', async () => {
    const tool = new TodoTool();
    const r = await tool.execute({ operation: 'complete', id: 'missing' }, ctx);
    expect(r.isError).toBe(true);
    expect(r.output).toMatch(/not found/);
  });

  it('remove deletes todo', async () => {
    const tool = new TodoTool();
    const added = await tool.execute({ operation: 'add', content: 'to remove' }, ctx);
    const item = JSON.parse(added.output) as { id: string };
    const removed = await tool.execute({ operation: 'remove', id: item.id }, ctx);
    expect(removed.isError).toBe(false);
    const listed = await tool.execute({ operation: 'list' }, ctx);
    expect(listed.output).toBe('[]');
  });

  it('remove fails for unknown id', async () => {
    const tool = new TodoTool();
    const r = await tool.execute({ operation: 'remove', id: 'missing' }, ctx);
    expect(r.isError).toBe(true);
  });

  it('returns error for unknown operation', async () => {
    const tool = new TodoTool();
    const r = await tool.execute({ operation: 'warp' }, ctx);
    expect(r.isError).toBe(true);
    expect(r.output).toMatch(/unknown operation/i);
  });

  it('todos are scoped per agentId', async () => {
    const tool = new TodoTool();
    await tool.execute({ operation: 'add', content: 'for agent1' }, ctx);
    const otherCtx = { userId: 'u1', agentId: `other-${Date.now()}-${Math.random().toString(36).slice(2)}` };
    const r = await tool.execute({ operation: 'list' }, otherCtx);
    expect(r.output).toBe('[]');
  });
});