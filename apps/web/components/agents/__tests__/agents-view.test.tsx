import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AgentsView } from '../agents-view';

function mockFetch(agents: unknown[] = []) {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ agents }),
  } as Response);
}

describe('AgentsView', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = mockFetch([{ id: 'a1', name: 'Alpha', model: 'm', runtime: 'cloud', isActive: true }]);
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('renders action buttons', async () => {
    render(<AgentsView />);
    expect(screen.getByRole('button', { name: /new agent/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sync to orchestrator/i })).toBeInTheDocument();
    // settle the mount-time fetch inside this test's act() boundary
    await waitFor(() => expect(screen.getByText('Alpha')).toBeInTheDocument());
  });

  it('loads agents on mount', async () => {
    render(<AgentsView />);
    await waitFor(() => expect(screen.getByText('Alpha')).toBeInTheDocument());
  });

  it('opens sync modal', async () => {
    render(<AgentsView />);
    await userEvent.click(screen.getByRole('button', { name: /sync to orchestrator/i }));
    expect(await screen.findByText(/Sync Agents to Orchestrator/i)).toBeInTheDocument();
  });
});
