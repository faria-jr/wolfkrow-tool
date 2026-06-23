#!/usr/bin/env node
/**
 * MCP server: shopify
 *
 * Bridges to Shopify Admin REST API. Requires SHOPIFY_SHOP (e.g.
 * "my-store.myshopify.com") and SHOPIFY_ADMIN_TOKEN (admin API access token).
 */

import {
  type McpHandlers,
  type McpTool,
  type McpToolResult,
  runJsonRpcServer,
} from '@wolfkrow/mcp-shared';

function getShop(): string | undefined {
  return process.env['SHOPIFY_SHOP'];
}
function getToken(): string | undefined {
  return process.env['SHOPIFY_ADMIN_TOKEN'];
}

const tools: McpTool[] = [
  {
    name: 'list_products',
    description: 'List products in the Shopify store.',
    inputSchema: {
      type: 'object',
      properties: { limit: { type: 'number', description: 'Max products (default 20)' } },
    },
  },
  {
    name: 'get_product',
    description: 'Fetch a product by id.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'Shopify product id' } },
      required: ['id'],
    },
  },
  {
    name: 'count_products',
    description: 'Count total products in the store.',
    inputSchema: { type: 'object', properties: {} },
  },
];

function text(data: unknown): McpToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
}

function failure(message: string): McpToolResult {
  return { content: [{ type: 'text', text: message }], isError: true };
}

async function shopifyFetch(path: string, params?: Record<string, string>): Promise<unknown> {
  const shop = getShop();
  const token = getToken();
  if (!shop) throw new Error('SHOPIFY_SHOP not set');
  if (!token) throw new Error('SHOPIFY_ADMIN_TOKEN not set');
  const url = new URL(`https://${shop}/admin/api/2024-10${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  }
  const res = await fetch(url, {
    headers: {
      'X-Shopify-Access-Token': token,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Shopify ${path} -> ${res.status}: ${errText}`);
  }
  return res.json();
}

export const handlers: McpHandlers = {
  listTools: () => tools,
  callTool: async (name, args) => {
    try {
      if (name === 'list_products') {
        const limit = typeof args['limit'] === 'number' ? args['limit'] : 20;
        return text(await shopifyFetch('/products.json', { limit: String(limit) }));
      }
      if (name === 'get_product') {
        const id = String(args['id'] ?? '');
        if (!id) return failure('get_product requires an "id" argument');
        return text(await shopifyFetch(`/products/${encodeURIComponent(id)}.json`));
      }
      if (name === 'count_products') {
        return text(await shopifyFetch('/products/count.json'));
      }
      return failure(`Unknown tool: ${name}`);
    } catch (err) {
      return failure((err as Error).message);
    }
  },
};

runJsonRpcServer(process.stdin, process.stdout, handlers);
