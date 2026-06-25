import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { SchedulerView } from '../scheduler-view';

function makeTask() {
  return {
    id: 't1', name: 'Daily Briefing', description: 'd', cronExpression: '0 9 * * *', timezone: 'UTC',
    prompt: 'summarize news', agentId: undefined, enabled: true, tags: [], createdAt: '2024-01-01',
  };
}

describe('SchedulerView', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ tasks: [makeTask()] }),
    } as Response);
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('renders header and New Task button', async () => {
    render(<SchedulerView />);
    expect(screen.getByRole('heading', { name: 'Scheduler' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New Task' })).toBeInTheDocument();
    // settle the mount-time fetch inside this test's act() boundary
    await waitFor(() => expect(screen.getByText('Daily Briefing')).toBeInTheDocument());
  });

  it('loads tasks', async () => {
    render(<SchedulerView />);
    await waitFor(() => expect(screen.getByText('Daily Briefing')).toBeInTheDocument());
  });

  it('shows create form when New Task clicked', async () => {
    render(<SchedulerView />);
    await userEvent.click(screen.getByRole('button', { name: 'New Task' }));
    expect(screen.getByText('Create Scheduled Task')).toBeInTheDocument();
  });
});
