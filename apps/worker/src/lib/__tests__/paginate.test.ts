import { describe, expect, it } from 'vitest';

import { fromQuery, paginateArray, paginateTotal } from '../paginate';

describe('paginate', () => {
  it('paginateArray slices + reports total + hasMore', () => {
    const items = Array.from({ length: 25 }, (_, i) => i);
    const page1 = paginateArray({ limit: '10', offset: '0' }, items);
    expect(page1.items).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(page1.total).toBe(25);
    expect(page1.limit).toBe(10);
    expect(page1.offset).toBe(0);
    expect(page1.hasMore).toBe(true);
  });

  it('paginateArray last page hasMore=false', () => {
    const items = Array.from({ length: 25 }, (_, i) => i);
    const last = paginateArray({ limit: '10', offset: '20' }, items);
    expect(last.items).toEqual([20, 21, 22, 23, 24]);
    expect(last.hasMore).toBe(false);
  });

  it('paginateArray uses defaults (limit 20, offset 0) for bad/missing params', () => {
    const items = Array.from({ length: 5 }, (_, i) => i);
    const page = paginateArray({}, items);
    expect(page.limit).toBe(20);
    expect(page.offset).toBe(0);
    expect(page.items).toEqual([0, 1, 2, 3, 4]);
    expect(page.hasMore).toBe(false);
  });

  it('paginateArray clamps limit to 100', () => {
    const items = Array.from({ length: 5 }, (_, i) => i);
    const page = paginateArray({ limit: '9999' }, items);
    expect(page.limit).toBe(100);
  });

  it('paginateArray legacyKey copies the full array under that key', () => {
    const items = ['a', 'b', 'c'];
    const page = paginateArray({ limit: '2' }, items, 'skills');
    expect(page.skills).toEqual(['a', 'b', 'c']);
    expect(page.items).toEqual(['a', 'b']);
  });

  it('paginateTotal uses the provided total + hasMore from items length', () => {
    const page = paginateTotal({ limit: '10', offset: '20' }, [1, 2, 3], 50);
    expect(page.total).toBe(50);
    expect(page.hasMore).toBe(true);
    const last = paginateTotal({ limit: '10', offset: '40' }, [1, 2, 3, 4, 5], 45);
    expect(last.hasMore).toBe(false);
  });

  it('fromQuery reads string params and ignores non-strings', () => {
    expect(fromQuery({ limit: '5', offset: '10' })).toEqual({ limit: '5', offset: '10' });
    expect(fromQuery({ limit: 5 })).toEqual({});
    expect(fromQuery(undefined)).toEqual({});
  });
});
