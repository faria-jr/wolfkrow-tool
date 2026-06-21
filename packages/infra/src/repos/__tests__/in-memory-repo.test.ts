import { describe, expect, it } from 'vitest';

import type { Entity } from '../base';
import { InMemoryRepo } from '../base';

interface User extends Entity {
  id: string;
  name: string;
}

describe('InMemoryRepo', () => {
  it('save → findById → delete round-trip', async () => {
    const repo = new InMemoryRepo<User>();
    const user: User = { id: '1', name: 'Wolf' };

    await repo.save(user);
    expect(await repo.findById('1')).toEqual(user);
    expect(repo.snapshot()).toHaveLength(1);

    await repo.delete('1');
    expect(await repo.findById('1')).toBeNull();
    expect(repo.snapshot()).toHaveLength(0);
  });

  it('save upserts by id', async () => {
    const repo = new InMemoryRepo<User>();
    await repo.save({ id: '1', name: 'A' });
    await repo.save({ id: '1', name: 'B' });

    expect(repo.snapshot()).toEqual([{ id: '1', name: 'B' }]);
  });

  it('findById returns null when missing', async () => {
    expect(await new InMemoryRepo<User>().findById('nope')).toBeNull();
  });

  it('delete is idempotent', async () => {
    const repo = new InMemoryRepo<User>();
    await expect(repo.delete('ghost')).resolves.toBeUndefined();
  });
});
