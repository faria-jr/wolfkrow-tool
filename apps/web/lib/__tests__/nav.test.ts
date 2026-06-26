import { describe, expect, it } from 'vitest';

import { NAV_GROUPS, flattenNav } from '../nav';

describe('nav config', () => {
  it('lists Dashboard as the first Main item', () => {
    const main = NAV_GROUPS.find((g) => g.label === 'Main');
    expect(main?.items[0]?.url).toBe('/dashboard');
  });

  it('uses each icon at most once across all nav items (no duplicate icons)', () => {
    const all = flattenNav(NAV_GROUPS);
    const icons = all.map((i) => i.icon);
    // Set uses reference equality — lucide exports are unique references.
    expect(new Set(icons).size).toBe(icons.length);
  });

  it('keeps the Tools group (design/terminal/enrich/profiler) for palette parity', () => {
    const tools = NAV_GROUPS.find((g) => g.label === 'Tools');
    expect(tools?.items.map((i) => i.url)).toEqual(['/design', '/terminal', '/enrich', '/profiler']);
  });

  it('Graph and MCP Servers use distinct icons', () => {
    const all = flattenNav(NAV_GROUPS);
    const graph = all.find((i) => i.url === '/graph');
    const mcp = all.find((i) => i.url === '/mcp-servers');
    expect(graph?.icon).not.toBe(mcp?.icon);
  });

  it('Rules and Logs use distinct icons', () => {
    const all = flattenNav(NAV_GROUPS);
    const rules = all.find((i) => i.url === '/rules');
    const logs = all.find((i) => i.url === '/logs');
    expect(rules?.icon).not.toBe(logs?.icon);
  });
});
