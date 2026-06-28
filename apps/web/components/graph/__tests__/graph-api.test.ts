import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { deleteNode, fetchGraph, fetchNeighborhood, postIngest } from '../graph-api';

describe('graph-api', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('fetchGraph returns snapshot on ok', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ nodes: [], edges: [] }),
    } as Response);
    const result = await fetchGraph();
    expect(result).toEqual({ nodes: [], edges: [] });
  });

  it('fetchGraph throws on non-ok', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500 } as Response);
    await expect(fetchGraph()).rejects.toThrow('load failed (500)');
  });

  it('fetchNeighborhood returns null on non-ok', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 404 } as Response);
    expect(await fetchNeighborhood('n1')).toBeNull();
  });

  it('postIngest returns entity/edge counts', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ entityCount: 3, edgeCount: 5 }),
    } as Response);
    expect(await postIngest('text')).toEqual({ entityCount: 3, edgeCount: 5 });
  });

  it('deleteNode returns status code', async () => {
    fetchMock.mockResolvedValue({ status: 204 } as Response);
    expect(await deleteNode('n1')).toBe(204);
  });
});
