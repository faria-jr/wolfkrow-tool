import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SettingsView } from '../settings-view';

// EPIC 3.2 — Settings hub now only surfaces items that don't already have
// a sidebar entry. The 8 items previously duplicated here (Vault, Agents,
// MCP, Scheduler, Rules, Permissions, Channels, Usage) live in NAV_GROUPS
// already; the hub exists only for /settings/providers and /settings/voice
// which are orphan routes inside the /settings segment, plus a single
// workspace-data shortcut to /vault (kept as a convenience target).
const HUB_ROUTES = [
  '/settings/providers',
  '/settings/voice',
  '/vault',
] as const;

describe('SettingsView', () => {
  it('renders only the hub sections (no sidebar duplication)', () => {
    render(<SettingsView />);
    const links = screen.getAllByRole('link');
    const hrefs = links.map((l) => l.getAttribute('href'));
    for (const route of HUB_ROUTES) {
      expect(hrefs, `expected hub to link to ${route}`).toContain(route);
    }
  });

  it('never links to a dead /settings/* sub-route', () => {
    render(<SettingsView />);
    const links = screen.getAllByRole('link');
    const hrefs = links.map((l) => l.getAttribute('href') ?? '');
    const deadSettingsRoutes = hrefs.filter(
      (href) =>
        href.startsWith('/settings/') &&
        href !== '/settings/providers' &&
        href !== '/settings/voice',
    );
    expect(deadSettingsRoutes, 'no hub link may point at a non-existent /settings/* route').toEqual([]);
  });

  it('links exactly the expected number of hub sections', () => {
    render(<SettingsView />);
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(HUB_ROUTES.length);
  });

  it('does not duplicate items that already live in the sidebar', () => {
    render(<SettingsView />);
    const links = screen.getAllByRole('link');
    const hrefs = links.map((l) => l.getAttribute('href') ?? '');
    // EPIC 3.2 — sidebar already exposes Agents / MCP / Scheduler / Rules /
    // Permissions / Channels / Usage. The hub must not repeat them.
    for (const sidebarRoute of ['/agents', '/mcp-servers', '/scheduler', '/rules', '/permissions', '/channels', '/usage']) {
      expect(hrefs, `hub must not duplicate sidebar entry ${sidebarRoute}`).not.toContain(sidebarRoute);
    }
  });
});
