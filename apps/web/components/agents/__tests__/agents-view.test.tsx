import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRouter } from 'next/navigation';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AgentsView } from '../agents-view';

vi.mock('next/navigation', () => ({ useRouter: vi.fn() }));

function mockFetch(agents: unknown[] = []) {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ agents }),
  } as Response);
}

describe('AgentsView', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let push: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = mockFetch([
      { id: 'a1', name: 'Alpha', model: 'm', runtime: 'cloud', isActive: true },
    ]);
    vi.stubGlobal('fetch', fetchMock);
    push = vi.fn();
    vi.mocked(useRouter).mockReturnValue({ push } as unknown as ReturnType<typeof useRouter>);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('renders action buttons', async () => {
    render(<AgentsView />);
    expect(screen.getByRole('button', { name: /new agent/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sync to orchestrator/i })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Alpha')).toBeInTheDocument());
  });

  it('loads agents on mount', async () => {
    render(<AgentsView />);
    await waitFor(() => expect(screen.getByText('Alpha')).toBeInTheDocument());
  });

  it('shows error state when fetch fails and allows retry', async () => {
    fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: 'server error' }),
    } as Response);
    vi.stubGlobal('fetch', fetchMock);
    render(<AgentsView />);
    await waitFor(() => expect(screen.getByText(/failed to load agents/i)).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: /try again/i }));
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });

  it('navigates to dedicated edit route when Edit action clicked (EPIC 1.1)', async () => {
    const user = userEvent.setup();
    render(<AgentsView />);
    await waitFor(() => expect(screen.getByText('Alpha')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /edit agent/i }));

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith('/agents/a1/edit');
    });
  });
});
