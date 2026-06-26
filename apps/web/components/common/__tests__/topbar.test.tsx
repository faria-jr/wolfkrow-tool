import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Topbar } from '../topbar';

// Mutable pathname so we can assert breadcrumb formatting across routes.
let mockPathname = '/chat';
vi.mock('next/navigation', () => ({
  get usePathname() {
    return () => mockPathname;
  },
}));

vi.mock('@/components/ui/sidebar', () => ({
  SidebarTrigger: (props: React.ComponentProps<'button'>) => (
    <button type="button" data-sidebar="trigger" {...props}>
      Toggle
    </button>
  ),
}));

describe('Topbar', () => {
  it('renders the SidebarTrigger so the sidebar is reachable on mobile', () => {
    mockPathname = '/chat';
    render(<Topbar />);
    const trigger = screen.getByRole('button', { name: 'Toggle' });
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveAttribute('data-sidebar', 'trigger');
  });

  it('renders breadcrumb from the current pathname', () => {
    mockPathname = '/agents';
    render(<Topbar />);
    expect(screen.getByText('Agents')).toBeInTheDocument();
  });

  it('renders actions slot', () => {
    mockPathname = '/agents';
    render(<Topbar actions={<button type="button">Save</button>} />);
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });

  it('hides breadcrumb on flush routes (chat owns its header)', () => {
    mockPathname = '/chat';
    render(<Topbar actions={<button type="button">Save</button>} />);
    expect(screen.queryByText('Chat')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
  });

  it('shows Dashboard for the root route', () => {
    mockPathname = '/';
    render(<Topbar />);
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('formats a settings sub-page as a nested breadcrumb', () => {
    mockPathname = '/settings/voice';
    const { container } = render(<Topbar />);
    const breadcrumbText = container.querySelector('.text-foreground')?.parentElement?.textContent;
    expect(breadcrumbText).toContain('Settings');
    expect(breadcrumbText).toContain('Voice');
  });

  it('collapses a UUID segment to Details instead of gibberish', () => {
    mockPathname = '/pipeline/projects/abc123d4-1234-1234-1234-1234567890ab/report';
    const { container } = render(<Topbar />);
    const text = container.querySelector('.text-foreground')?.parentElement?.textContent ?? '';
    expect(text).toContain('Pipeline');
    expect(text).toContain('Projects');
    expect(text).toContain('Report');
    // The raw UUID must NOT leak into the breadcrumb.
    expect(text).not.toContain('abc123d4');
    expect(text).not.toContain('Abc 123');
  });
});
