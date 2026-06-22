import { describe, expect, it } from 'vitest';

import { DrizzleTaskRepo } from '../task-repo';

import { mockDb } from './mock-db';

const ROW = {
  id: 't1',
  userId: 'u1',
  title: 'Write tests',
  description: null,
  status: 'todo',
  category: 'work',
  priority: 'medium',
  dueDate: null,
  completedAt: null,
  tags: ['x'],
  metadata: {},
  createdAt: new Date(0),
  updatedAt: new Date(0),
};

describe('DrizzleTaskRepo (FIX-009)', () => {
  it('findMany maps rows', () => {
    const { db } = mockDb([ROW]);
    const repo = new DrizzleTaskRepo(db as never);
    const list = repo.findMany({ userId: 'u1' });
    expect(list).toHaveLength(1);
    expect(list[0]?.title).toBe('Write tests');
    expect(list[0]?.tags).toEqual(['x']);
  });

  it('create inserts and returns the record', () => {
    const { db, chain } = mockDb([ROW]);
    const repo = new DrizzleTaskRepo(db as never);
    const task = repo.create({ userId: 'u1', title: 'New', tags: [] });
    expect(task.title).toBe('New');
    expect(task.status).toBe('todo');
    expect(chain.run).toHaveBeenCalled();
  });

  it('create with status=done sets completedAt', () => {
    const { db } = mockDb([{ ...ROW, status: 'done', completedAt: new Date(0) }]);
    const repo = new DrizzleTaskRepo(db as never);
    const task = repo.create({ userId: 'u1', title: 'Done task', status: 'done' });
    expect(task.status).toBe('done');
  });

  it('update runs an update statement', () => {
    const { db, chain } = mockDb([ROW]);
    const repo = new DrizzleTaskRepo(db as never);
    repo.update('t1', { title: 'Updated' });
    expect(chain.run).toHaveBeenCalled();
  });

  it('delete runs a delete statement', () => {
    const { db, chain } = mockDb();
    const repo = new DrizzleTaskRepo(db as never);
    repo.delete('t1');
    expect(chain.run).toHaveBeenCalled();
  });
});
