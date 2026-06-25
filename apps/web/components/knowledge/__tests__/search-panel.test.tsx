import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SearchPanel } from '../search-panel';

describe('SearchPanel', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // FE-4: api-client uses .text() + JSON.parse, not .json()
    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ results: [{ chunkId: 'c1', documentId: 'doc-1234567890', content: 'hello', score: 0.9, metadata: { sourceType: 'text' } }] }),
    } as Response);
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('renders search input and button', () => {
    render(<SearchPanel />);
    expect(screen.getByPlaceholderText(/search your documents/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /search/i })).toBeDisabled();
  });

  it('shows results after search', async () => {
    render(<SearchPanel />);
    await userEvent.type(screen.getByPlaceholderText(/search your documents/i), 'hello');
    await userEvent.click(screen.getByRole('button', { name: /search/i }));
    expect(await screen.findByText('hello')).toBeInTheDocument();
    expect(screen.getByText(/doc:doc-1234/i)).toBeInTheDocument();
  });

  it('shows no results message when empty', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify({ results: [] }) } as Response);
    render(<SearchPanel />);
    await userEvent.type(screen.getByPlaceholderText(/search your documents/i), 'zzz');
    await userEvent.click(screen.getByRole('button', { name: /search/i }));
    expect(await screen.findByText(/no results found/i)).toBeInTheDocument();
  });
});
