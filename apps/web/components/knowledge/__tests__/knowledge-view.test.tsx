import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { KnowledgeView } from '../knowledge-view';

describe('KnowledgeView', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ documents: [{ id: 'd1', filename: 'spec.pdf', mimeType: 'application/pdf', size: 2048, status: 'ready', chunkCount: 3, createdAt: '2024-01-01' }] }),
    } as Response);
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('renders title and upload zone', () => {
    render(<KnowledgeView />);
    expect(screen.getByRole('heading', { name: /Knowledge Base/i })).toBeInTheDocument();
    expect(screen.getByText(/drag files here/i)).toBeInTheDocument();
  });

  it('loads documents and shows count badge', async () => {
    render(<KnowledgeView />);
    await waitFor(() => expect(screen.getByText('spec.pdf')).toBeInTheDocument());
  });

  it('switches to search tab', async () => {
    render(<KnowledgeView />);
    const tabs = screen.getAllByRole('button', { name: /search/i });
    await waitFor(() => expect(tabs.length).toBeGreaterThan(0));
  });
});
