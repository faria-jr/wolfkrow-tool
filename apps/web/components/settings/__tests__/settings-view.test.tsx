import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SettingsView } from '../settings-view';

/**
 * Authoritative map of Settings hub destinations → real routes.
 * Every href rendered by SettingsView MUST resolve to one of these
 * (P0-5: no dead `/settings/*` tabs, single navigation source).
 */
const REAL_ROUTES = [
  '/settings/providers',
  '/vault',
  '/agents',
  '/mcp-servers',
  '/scheduler',
  '/rules',
  '/permissions',
  '/channels',
  '/usage',
] as const;

describe('SettingsView', () => {
  it('renders a link to every real config route', () => {
    render(<SettingsView />);
    const links = screen.getAllByRole('link');
    const hrefs = links.map((l) => l.getAttribute('href'));
    for (const route of REAL_ROUTES) {
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
        !REAL_ROUTES.includes(href as (typeof REAL_ROUTES)[number]),
    );
    expect(deadSettingsRoutes, 'no hub link may point at a non-existent /settings/* route').toEqual([]);
  });

  it('links exactly the expected number of sections (no duplication)', () => {
    render(<SettingsView />);
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(REAL_ROUTES.length);
  });
});
