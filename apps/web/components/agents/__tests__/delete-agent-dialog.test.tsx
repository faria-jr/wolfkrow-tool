import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DeleteAgentDialog } from '../delete-agent-dialog';

describe('DeleteAgentDialog', () => {
  it('renders agent name when open', () => {
    render(<DeleteAgentDialog open agentName="Alpha" onClose={vi.fn()} onConfirm={vi.fn()} />);
    expect(screen.getByText('Delete agent')).toBeInTheDocument();
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
  });

  it('disables confirm button while loading', () => {
    render(<DeleteAgentDialog open agentName="Alpha" onClose={vi.fn()} onConfirm={vi.fn()} loading />);
    expect(screen.getByRole('button', { name: /deleting/i })).toBeDisabled();
  });

  it('fires onConfirm on delete click', async () => {
    const onConfirm = vi.fn();
    render(<DeleteAgentDialog open agentName="Alpha" onClose={vi.fn()} onConfirm={onConfirm} />);
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onConfirm).toHaveBeenCalled();
  });
});
