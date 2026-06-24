import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RoundsList } from '../rounds-list';

function makeRound(overrides: Partial<{
  id: string;
  roundNumber: number;
  coderOutput: string | null;
  evaluatorFeedback: string | null;
  passed: boolean;
  tokens: number;
}> = {}): Record<string, unknown> {
  return {
    id: 'round-1',
    sprintId: 'sprint-1',
    featureIndex: 0,
    roundNumber: 1,
    coderOutput: 'old code',
    evaluatorFeedback: 'looks bad',
    passed: false,
    tokens: 120,
    startedAt: '2024-01-01T00:00:00.000Z',
    completedAt: '2024-01-01T00:01:00.000Z',
    ...overrides,
  };
}

describe('RoundsList (M5.3 integration)', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('shows a loading state while the request is in flight', () => {
    fetchMock.mockReturnValue(new Promise(() => undefined));
    render(<RoundsList sprintId="sprint-1" />);
    expect(screen.getByText(/Loading rounds/)).toBeInTheDocument();
  });

  it('fetches rounds and renders the empty state when none exist', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => [] });
    render(<RoundsList sprintId="sprint-1" />);
    await waitFor(() => expect(screen.getByText(/No rounds yet/)).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/harness/sprints/sprint-1/rounds',
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  it('shows an error block when the API returns non-ok', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
    render(<RoundsList sprintId="sprint-1" />);
    await waitFor(() => expect(screen.getByText(/Failed to load rounds: 500/)).toBeInTheDocument());
  });

  it('shows an error block when fetch throws', async () => {
    fetchMock.mockRejectedValue(new Error('network down'));
    render(<RoundsList sprintId="sprint-1" />);
    await waitFor(() => expect(screen.getByText(/network down/)).toBeInTheDocument());
  });

  it('renders round headers and evaluator feedback for a single round', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [makeRound({ id: 'r1', roundNumber: 1, passed: false, evaluatorFeedback: 'fix the bug' })],
    });
    render(<RoundsList sprintId="sprint-1" />);
    await waitFor(() => expect(screen.getByText('Round 1')).toBeInTheDocument());
    expect(screen.getByText(/fix the bug/)).toBeInTheDocument();
    expect(screen.getByText('failed')).toBeInTheDocument();
  });

  it('does not show a diff toggle for the first round', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [makeRound({ id: 'r1', roundNumber: 1, coderOutput: 'v1' })],
    });
    const { container } = render(<RoundsList sprintId="sprint-1" />);
    await waitFor(() => expect(screen.getByText('Round 1')).toBeInTheDocument());
    expect(container.querySelector('[data-testid="round-diff"]')).toBeNull();
  });

  it('shows a diff toggle for round 2 with a DiffViewer that opens', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [
        makeRound({ id: 'r1', roundNumber: 1, coderOutput: 'foo' }),
        makeRound({ id: 'r2', roundNumber: 2, coderOutput: 'bar', passed: true }),
      ],
    });
    render(<RoundsList sprintId="sprint-1" />);
    await waitFor(() => expect(screen.getByText('Round 2')).toBeInTheDocument());
    const toggle = await screen.findByText(/Show diff vs round 1/);
    await userEvent.click(toggle);
    expect(await screen.findByTestId('diff-viewer-body')).toBeInTheDocument();
  });
});
