import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MemoryView } from '../memory-view';

describe('MemoryView', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ memories: [{ id: 'm1', content: 'remembered this', source: 'user', importance: 5, accessCount: 2, createdAt: '2024-01-01' }] }),
    } as Response);
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('renders header and list tab by default', async () => {
    render(<MemoryView />);
    expect(screen.getByRole('heading', { name: 'Memory' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'list' })).toBeInTheDocument();
    // settle the mount-time fetch inside this test's act() boundary
    await waitFor(() => expect(screen.getByText('remembered this')).toBeInTheDocument());
  });

  it('loads and displays memories', async () => {
    render(<MemoryView />);
    await waitFor(() => expect(screen.getByText('remembered this')).toBeInTheDocument());
  });

  it('switches to search tab and searches', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ memories: [] }) } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ results: [{ memory: { id: 'm1', content: 'found', source: 'user', importance: 1, accessCount: 0, createdAt: '2024-01-01' }, distance: 0.1 }] }) } as Response);
    render(<MemoryView />);
    await userEvent.click(screen.getByRole('button', { name: 'search' }));
    await userEvent.type(screen.getByPlaceholderText(/search memories/i), 'query');
    await userEvent.click(screen.getByRole('button', { name: 'Search' }));
    expect(await screen.findByText('found')).toBeInTheDocument();
  });

  it('shows a summaries tab', async () => {
    render(<MemoryView />);
    expect(screen.getByRole('button', { name: 'summaries' })).toBeInTheDocument();
    // settle the mount-time fetch inside this test's act() boundary
    await waitFor(() => expect(screen.getByText('remembered this')).toBeInTheDocument());
  });

  it('fetches daily summaries when the summaries tab is activated', async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.endsWith('/api/memory/summaries')) {
        return {
          ok: true,
          json: async () => ({
            summaries: [
              {
                id: 's1',
                userId: 'u1',
                date: '2024-05-20',
                content: 'User likes dark mode.',
                sessionCount: 3,
                messageCount: 47,
                tokensUsed: 1200,
                cost: 0.0024,
                createdAt: '2024-05-21T00:00:00.000Z',
              },
            ],
          }),
        } as Response;
      }
      // Default for /api/memory
      return {
        ok: true,
        json: async () => ({ memories: [] }),
      } as Response;
    });
    render(<MemoryView />);
    await userEvent.click(screen.getByRole('button', { name: 'summaries' }));
    await waitFor(() => {
      expect(screen.getByTestId('daily-summaries')).toBeInTheDocument();
    });
    expect(screen.getByText('User likes dark mode.')).toBeInTheDocument();
    expect(screen.getByText('2024-05-20')).toBeInTheDocument();
    expect(screen.getByText('3 sessions')).toBeInTheDocument();
  });

  it('shows an error block when summaries fetch fails', async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.endsWith('/api/memory/summaries')) {
        return { ok: false, status: 500, json: async () => ({}) } as Response;
      }
      return { ok: true, json: async () => ({ memories: [] }) } as Response;
    });
    render(<MemoryView />);
    await userEvent.click(screen.getByRole('button', { name: 'summaries' }));
    await waitFor(() => {
      expect(screen.getByText(/HTTP 500/)).toBeInTheDocument();
    });
  });

  it('shows an empty state when there are no summaries', async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.endsWith('/api/memory/summaries')) {
        return { ok: true, json: async () => ({ summaries: [] }) } as Response;
      }
      return { ok: true, json: async () => ({ memories: [] }) } as Response;
    });
    render(<MemoryView />);
    await userEvent.click(screen.getByRole('button', { name: 'summaries' }));
    await waitFor(() => {
      expect(screen.getByText(/No daily summaries yet/)).toBeInTheDocument();
    });
  });

  it('shows a Compact now button on the list tab that posts to /api/memory/summaries', async () => {
    let postCalled = 0;
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.endsWith('/api/memory/summaries') && init?.method === 'POST') {
        postCalled++;
        return {
          ok: true,
          json: async () => ({
            summary: {
              id: 's1', userId: 'u1', date: '2024-05-21', content: 'summary',
              sessionCount: 0, messageCount: 0, tokensUsed: 0, cost: 0,
              createdAt: '2024-05-21T00:00:00.000Z',
            },
          }),
        } as Response;
      }
      if (url.endsWith('/api/memory/summaries')) {
        return { ok: true, json: async () => ({ summaries: [] }) } as Response;
      }
      // /api/memory — return at least one memory so the list tab renders
      return {
        ok: true,
        json: async () => ({
          memories: [{
            id: 'm1', content: 'remembered this', source: 'user',
            importance: 5, accessCount: 2, createdAt: '2024-01-01',
          }],
        }),
      } as Response;
    });
    render(<MemoryView />);
    await waitFor(() => {
      expect(screen.getByTestId('compact-now')).toBeInTheDocument();
    });
    await userEvent.click(screen.getByTestId('compact-now'));
    expect(postCalled).toBe(1);
  });
});
