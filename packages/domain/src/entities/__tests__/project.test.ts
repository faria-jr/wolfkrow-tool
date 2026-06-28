import { describe, expect, it } from 'vitest';

import { Project } from '../project';

const baseInput = { userId: 'u1', name: 'My Project' };

describe('Project', () => {
  it('create() defaults status/tags and assigns an id + timestamps', () => {
    const p = Project.create(baseInput);
    expect(p.id).toBeTruthy();
    expect(p.userId).toBe('u1');
    expect(p.name).toBe('My Project');
    expect(p.status).toBe('active');
    expect(p.tags).toEqual([]);
    expect(p.createdAt).toEqual(p.updatedAt);
    expect(p.description).toBeUndefined();
    expect(p.rootPath).toBeUndefined();
  });

  it('create() accepts optional fields', () => {
    const p = Project.create({
      ...baseInput,
      description: 'desc',
      rootPath: '/repo',
      specPath: '/repo/spec.md',
      defaultProviderId: 'anthropic',
      defaultPlannerModel: 'opus',
      defaultCoderModel: 'sonnet',
      tags: ['a', 'b'],
    });
    expect(p.description).toBe('desc');
    expect(p.rootPath).toBe('/repo');
    expect(p.tags).toEqual(['a', 'b']);
  });

  it('create() copies tags so callers cannot mutate the input array later', () => {
    const tags = ['x'];
    const p = Project.create({ ...baseInput, tags });
    tags.push('y');
    expect([...p.tags]).toEqual(['x']);
  });

  it('toProps() round-trips through fromProps()', () => {
    const p = Project.create({ ...baseInput, rootPath: '/repo', tags: ['a'] });
    const again = Project.fromProps(p.toProps());
    expect(again.toProps()).toEqual(p.toProps());
  });

  it('with() merges fields, bumps updatedAt, and copies tags', () => {
    const p = Project.create(baseInput);
    const updated = p.with({ name: 'Renamed', tags: ['new'] });
    expect(updated.name).toBe('Renamed');
    expect(updated.id).toBe(p.id);
    expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(p.updatedAt.getTime());
    expect([...updated.tags]).toEqual(['new']);
  });

  it('with() bumps updatedAt even when no fields are provided', () => {
    const p = Project.create({ ...baseInput, rootPath: '/repo' });
    const updated = p.with({});
    expect(updated.name).toBe('My Project');
    expect(updated.rootPath).toBe('/repo');
    expect(updated.updatedAt).not.toBe(p.updatedAt);
  });

  it('with() can archive via status', () => {
    const p = Project.create(baseInput);
    expect(p.with({ status: 'archived' }).status).toBe('archived');
  });
});
