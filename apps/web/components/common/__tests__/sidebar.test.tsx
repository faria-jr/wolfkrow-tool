import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Sidebar } from '../sidebar';

vi.mock('next/navigation', () => ({
  usePathname: () => '/chat',
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/components/ui/sidebar', () => ({
  SidebarContent: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  SidebarFooter: ({ children }: React.PropsWithChildren) => <footer>{children}</footer>,
  SidebarGroup: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  SidebarGroupContent: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  SidebarGroupLabel: ({ children }: React.PropsWithChildren) => <span>{children}</span>,
  SidebarHeader: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  SidebarMenu: ({ children }: React.PropsWithChildren) => <ul>{children}</ul>,
  SidebarMenuButton: ({
    children,
    asChild: _a,
    isActive: _i,
    tooltip: _t,
    ...p
  }: React.PropsWithChildren<Record<string, unknown>>) => <div {...p}>{children}</div>,
  SidebarMenuItem: ({ children }: React.PropsWithChildren) => <li>{children}</li>,
  SidebarRail: () => <div />,
}));

describe('Sidebar nav links', () => {
  it('MCP Servers links to /mcp-servers (not /mcp)', () => {
    render(<Sidebar />);
    const links = screen.getAllByRole('link');
    const mcpLink = links.find((l) => l.textContent?.includes('MCP Servers'));
    expect(mcpLink).toBeTruthy();
    expect(mcpLink?.getAttribute('href')).toBe('/mcp-servers');
  });

  it('Settings links to /settings', () => {
    render(<Sidebar />);
    const links = screen.getAllByRole('link');
    const settingsLink = links.find((l) => l.textContent?.includes('Settings'));
    expect(settingsLink).toBeTruthy();
    expect(settingsLink?.getAttribute('href')).toBe('/settings');
  });
});
