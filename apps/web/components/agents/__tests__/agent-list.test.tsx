import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { AgentData } from '../agent-form-modal';
import { AgentList } from '../agent-list';

const agent: AgentData = {
  id: 'a1',
  name: 'Alpha',
  model: 'claude-sonnet-4',
  effort: 'high',
  thinking: false,
  maxTurns: 10,
  allowedTools: [],
  mcpServers: [],
  isActive: true,
  skills: [],
  runtime: 'cloud',
};

describe('AgentList', () => {
  it('renders empty state when no agents', () => {
    render(<AgentList agents={[]} onEdit={vi.fn()} onDuplicate={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText(/no agents yet/i)).toBeInTheDocument();
  });

  it('renders agent rows with name and status', () => {
    render(
      <AgentList agents={[agent]} onEdit={vi.fn()} onDuplicate={vi.fn()} onDelete={vi.fn()} />
    );
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('active')).toBeInTheDocument();
  });

  it('fires onEdit when edit button clicked', async () => {
    const onEdit = vi.fn();
    render(<AgentList agents={[agent]} onEdit={onEdit} onDuplicate={vi.fn()} onDelete={vi.fn()} />);
    await userEvent.click(screen.getByLabelText('Edit agent'));
    expect(onEdit).toHaveBeenCalledWith(agent);
  });

  it('opens confirm dialog on delete and confirms', async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    render(
      <AgentList agents={[agent]} onEdit={vi.fn()} onDuplicate={vi.fn()} onDelete={onDelete} />
    );
    await userEvent.click(screen.getByLabelText('Delete agent'));
    expect(await screen.findByText('Delete agent')).toBeInTheDocument();
    const deleteBtn = screen
      .getAllByRole('button', { name: 'Delete' })
      .find((b) => !b.hasAttribute('aria-label'));
    await userEvent.click(deleteBtn!);
    await vi.waitFor(() => expect(onDelete).toHaveBeenCalledWith('a1'));
  });
});
