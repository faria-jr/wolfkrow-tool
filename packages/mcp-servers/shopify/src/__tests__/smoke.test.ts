import { handleRpcMessage } from '@wolfkrow/mcp-shared';
import { afterEach, describe, expect, it, vi } from 'vitest';


import { handlers } from '../index';

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env['SHOPIFY_SHOP'];
  delete process.env['SHOPIFY_ADMIN_TOKEN'];
});

function makeFetchOk(body: unknown): ReturnType<typeof vi.fn> {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: async () => body,
  });
}

describe('shopify MCP server smoke tests', () => {
  it('initialize handshake returns protocol version and tools capability', async () => {
    const res = await handleRpcMessage({ jsonrpc: '2.0', id: 1, method: 'initialize' }, handlers);
    expect(res?.result).toMatchObject({
      protocolVersion: expect.any(String),
      capabilities: { tools: {} },
    });
  });

  it('tools/list returns list_products, get_product, count_products', async () => {
    const res = await handleRpcMessage({ jsonrpc: '2.0', id: 2, method: 'tools/list' }, handlers);
    const tools = (res?.result as { tools: { name: string }[] })?.tools ?? [];
    const names = tools.map((t) => t.name);
    expect(names).toEqual(
      expect.arrayContaining(['list_products', 'get_product', 'count_products']),
    );
  });

  it('list_products calls Shopify Admin API', async () => {
    process.env['SHOPIFY_SHOP'] = 'store.myshopify.com';
    process.env['SHOPIFY_ADMIN_TOKEN'] = 't';
    vi.stubGlobal('fetch', makeFetchOk({ products: [] }));
    const res = await handleRpcMessage(
      { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'list_products', arguments: {} } },
      handlers,
    );
    expect(res?.result).toMatchObject({ content: expect.any(Array) });
    const url = String(vi.mocked(fetch).mock.calls[0]?.[0]);
    expect(url).toContain('https://store.myshopify.com/admin/api/2024-10/products.json');
    expect(url).toContain('limit=20');
  });

  it('count_products returns count field', async () => {
    process.env['SHOPIFY_SHOP'] = 'store.myshopify.com';
    process.env['SHOPIFY_ADMIN_TOKEN'] = 't';
    vi.stubGlobal('fetch', makeFetchOk({ count: 42 }));
    const res = await handleRpcMessage(
      { jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'count_products', arguments: {} } },
      handlers,
    );
    expect(res?.result).toMatchObject({ content: expect.any(Array) });
  });

  it('get_product requires id', async () => {
    process.env['SHOPIFY_SHOP'] = 'store.myshopify.com';
    process.env['SHOPIFY_ADMIN_TOKEN'] = 't';
    const res = await handleRpcMessage(
      { jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'get_product', arguments: {} } },
      handlers,
    );
    expect(res?.result).toMatchObject({ isError: true });
  });

  it('returns isError when env missing', async () => {
    const res = await handleRpcMessage(
      { jsonrpc: '2.0', id: 6, method: 'tools/call', params: { name: 'list_products', arguments: {} } },
      handlers,
    );
    expect(res?.result).toMatchObject({ isError: true });
  });

  it('unknown tool returns isError', async () => {
    process.env['SHOPIFY_SHOP'] = 'store.myshopify.com';
    process.env['SHOPIFY_ADMIN_TOKEN'] = 't';
    const res = await handleRpcMessage(
      { jsonrpc: '2.0', id: 7, method: 'tools/call', params: { name: 'nope', arguments: {} } },
      handlers,
    );
    expect(res?.result).toMatchObject({ isError: true });
  });
});
