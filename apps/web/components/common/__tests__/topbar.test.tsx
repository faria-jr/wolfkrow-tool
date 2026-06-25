import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Topbar } from '../topbar';

vi.mock('next/navigation', () => ({
  usePathname: () => '/chat',
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
    render(<Topbar />);
    const trigger = screen.getByRole('button', { name: 'Toggle' });
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveAttribute('data-sidebar', 'trigger');
  });

  it('renders breadcrumb from the current pathname', () => {
    render(<Topbar />);
    expect(screen.getByText('Chat')).toBeInTheDocument();
  });

  it('renders actions slot', () => {
    render(<Topbar actions={<button type="button">Save</button>} />);
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });
});
