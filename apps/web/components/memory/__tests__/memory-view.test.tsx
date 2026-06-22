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

  it('renders header and list tab by default', () => {
    render(<MemoryView />);
    expect(screen.getByRole('heading', { name: 'Memory' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'list' })).toBeInTheDocument();
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
});
