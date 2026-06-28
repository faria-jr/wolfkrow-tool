import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { EmptyState } from './empty-state';

describe('EmptyState', () => {
  it('renders the title', () => {
    render(<EmptyState title="No agents yet" />);
    expect(screen.getByText('No agents yet')).toBeDefined();
  });

  it('renders the description when provided', () => {
    render(<EmptyState title="No agents yet" description="Create one to get started." />);
    expect(screen.getByText('Create one to get started.')).toBeDefined();
  });

  it('omits the action button when no action is provided', () => {
    render(<EmptyState title="No agents yet" />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('renders and triggers the action button', async () => {
    const onAction = vi.fn();
    const user = userEvent.setup();
    render(
      <EmptyState title="No agents yet" action={{ label: 'Create agent', onClick: onAction }} />
    );

    await user.click(screen.getByRole('button', { name: 'Create agent' }));
    expect(onAction).toHaveBeenCalledOnce();
  });
});
