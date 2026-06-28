import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Sidebar } from '../sidebar';

// Mutable pathname so individual tests can exercise active state for
// different routes (including nested ones).
let mockPathname = '/chat';
vi.mock('next/navigation', () => ({
  get usePathname() {
    return () => mockPathname;
  },
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/hooks/use-sidebar-counts', () => ({
  useSidebarCounts: () => ({ agents: 0, skills: 0, mcp: 0 }),
}));

vi.mock('@/components/ui/sidebar', () => ({
  SidebarContent: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  SidebarFooter: ({ children }: React.PropsWithChildren) => <footer>{children}</footer>,
  SidebarGroup: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  SidebarGroupContent: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  SidebarGroupLabel: ({ children }: React.PropsWithChildren) => <span>{children}</span>,
  SidebarHeader: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  SidebarMenu: ({ children }: React.PropsWithChildren) => <ul>{children}</ul>,
  SidebarMenuBadge: ({ children }: React.PropsWithChildren) => <span>{children}</span>,
  SidebarMenuButton: ({
    children,
    asChild: _a,
    isActive,
    tooltip: _t,
    ...p
  }: React.PropsWithChildren<Record<string, unknown> & { isActive?: boolean }>) => (
    <div data-active={isActive ? 'true' : undefined} {...p}>
      {children}
    </div>
  ),
  SidebarMenuItem: ({ children }: React.PropsWithChildren) => <li>{children}</li>,
  SidebarRail: () => <div />,
}));

function linkByLabel(text: string) {
  const links = screen.getAllByRole('link');
  return links.find((l) => l.textContent?.includes(text));
}

describe('Sidebar nav links', () => {
  it('MCP Servers links to /mcp-servers (not /mcp)', () => {
    render(<Sidebar />);
    const mcpLink = linkByLabel('MCP Servers');
    expect(mcpLink).toBeTruthy();
    expect(mcpLink?.getAttribute('href')).toBe('/mcp-servers');
  });

  it('Settings links to /settings', () => {
    render(<Sidebar />);
    const settingsLink = linkByLabel('Settings');
    expect(settingsLink).toBeTruthy();
    expect(settingsLink?.getAttribute('href')).toBe('/settings');
  });

  it('previously URL-only pages are now in the sidebar', () => {
    render(<Sidebar />);
    const hrefs = screen.getAllByRole('link').map((l) => l.getAttribute('href'));
    // These were reachable only by URL before P2-8.
    for (const url of ['/design', '/terminal', '/enrich', '/usage']) {
      expect(hrefs).toContain(url);
    }
  });

  it('every top-level app page route has a discoverable sidebar entry', () => {
    // Static list of all top-level page routes under apps/web/app/(app)/.
    // Dynamic segments (e.g. /pipeline/projects/[id]/report) and Settings
    // sub-routes (/settings/providers) are reachable via their parent page
    // (Pipeline list / Settings hub) and are intentionally excluded here.
    const topLevelRoutes = [
      '/agents',
      '/audit',
      '/channels',
      '/chat',
      '/design',
      '/enrich',
      '/graph',
      '/harness',
      '/knowledge',
      '/logs',
      '/mcp-servers',
      '/memory',
      '/permissions',
      '/pipeline',
      '/projects',
      '/rules',
      '/scheduler',
      '/settings',
      '/skills',
      '/tasks',
      '/terminal',
      '/usage',
      '/vault',
    ];

    render(<Sidebar />);
    const hrefs = screen.getAllByRole('link').map((l) => l.getAttribute('href'));

    const missing = topLevelRoutes.filter((url) => !hrefs.includes(url));
    expect(missing).toEqual([]);
  });

  it('marks only the current top-level route active on exact match', () => {
    mockPathname = '/pipeline';
    render(<Sidebar />);
    const pipelineWrapper = linkByLabel('Pipeline')?.parentElement;
    const chatWrapper = linkByLabel('Chat')?.parentElement;
    expect(pipelineWrapper).toHaveAttribute('data-active', 'true');
    expect(chatWrapper).not.toHaveAttribute('data-active');
  });

  it('keeps the parent highlighted on a nested route (pipeline report)', () => {
    // /pipeline/projects/<id>/report must still highlight Pipeline, and must
    // NOT highlight a sibling like Tasks.
    mockPathname = '/pipeline/projects/abc123d4-1234-1234-1234-1234567890ab/report';
    render(<Sidebar />);
    const pipelineWrapper = linkByLabel('Pipeline')?.parentElement;
    const tasksWrapper = linkByLabel('Tasks')?.parentElement;
    expect(pipelineWrapper).toHaveAttribute('data-active', 'true');
    expect(tasksWrapper).not.toHaveAttribute('data-active');
  });

  it('keeps Settings highlighted on a settings sub-route', () => {
    mockPathname = '/settings/voice';
    render(<Sidebar />);
    const settingsWrapper = linkByLabel('Settings')?.parentElement;
    expect(settingsWrapper).toHaveAttribute('data-active', 'true');
  });

  it('does not false-match a sibling prefix (/usage vs /users)', () => {
    mockPathname = '/usage';
    render(<Sidebar />);
    // There is no /users nav item, but verify /usage is active and nothing
    // else is accidentally active due to naive prefix logic.
    const usageWrapper = linkByLabel('Usage')?.parentElement;
    expect(usageWrapper).toHaveAttribute('data-active', 'true');
    const activeCount = screen
      .getAllByRole('link')
      .filter((l) => l.parentElement?.getAttribute('data-active') === 'true').length;
    expect(activeCount).toBe(1);
  });
});
