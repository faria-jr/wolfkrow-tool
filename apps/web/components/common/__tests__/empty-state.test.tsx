import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { EmptyState } from '../empty-state';

describe('EmptyState', () => {
  it('renders title', () => {
    render(<EmptyState title="No agents yet" />);
    expect(screen.getByRole('heading', { name: 'No agents yet' })).toBeInTheDocument();
  });

  it('renders description when provided', () => {
    render(<EmptyState title="Empty" description="Add your first agent." />);
    expect(screen.getByText('Add your first agent.')).toBeInTheDocument();
  });

  it('renders action button and calls onClick', async () => {
    const onClick = vi.fn();
    render(
      <EmptyState
        title="Empty"
        description="d"
        action={{ label: 'Add new', onClick }}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Add new' }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('does not render button when action is absent', () => {
    render(<EmptyState title="Empty" />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('renders icon when provided', () => {
    render(
      <EmptyState
        title="Empty"
        icon={<span data-testid="icon">⭐</span>}
      />,
    );
    expect(screen.getByTestId('icon')).toBeInTheDocument();
  });
});
