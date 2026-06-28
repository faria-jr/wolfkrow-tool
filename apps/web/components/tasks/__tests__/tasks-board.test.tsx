import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TasksBoard } from '../tasks-board';

function makeTask(status = 'todo') {
  return {
    id: 't1',
    title: 'My Task',
    description: null,
    status,
    priority: 'high',
    category: 'dev',
    dueDate: null,
    tags: [],
  };
}

describe('TasksBoard', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ tasks: [makeTask()] }),
    } as Response);
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('renders column headers and New Task button', async () => {
    render(<TasksBoard />);
    expect(screen.getByRole('button', { name: 'New Task' })).toBeInTheDocument();
    expect(screen.getByText('Todo')).toBeInTheDocument();
    expect(screen.getByText('In Progress')).toBeInTheDocument();
    expect(screen.getByText('Blocked')).toBeInTheDocument();
    expect(screen.getByText('Done')).toBeInTheDocument();
    // settle the mount-time fetch inside this test's act() boundary
    await waitFor(() => expect(screen.getByText('My Task')).toBeInTheDocument());
  });

  it('loads and displays tasks', async () => {
    render(<TasksBoard />);
    await waitFor(() => expect(screen.getByText('My Task')).toBeInTheDocument());
  });

  it('shows form on New Task', async () => {
    render(<TasksBoard />);
    await userEvent.click(screen.getByRole('button', { name: 'New Task' }));
    expect(screen.getByPlaceholderText(/task title/i)).toBeInTheDocument();
  });
});
