import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DocumentList } from '../document-list';

const doc = {
  id: 'd1',
  filename: 'spec.pdf',
  mimeType: 'application/pdf',
  size: 1024,
  status: 'ready' as const,
  chunkCount: 3,
  createdAt: '2024-01-01',
};

describe('DocumentList', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue({ ok: true } as Response);
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('shows empty state when no documents', () => {
    render(<DocumentList documents={[]} onDeleted={vi.fn()} />);
    expect(screen.getByText(/no documents yet/i)).toBeInTheDocument();
  });

  it('renders document filename and size', () => {
    render(<DocumentList documents={[doc]} onDeleted={vi.fn()} />);
    expect(screen.getByText('spec.pdf')).toBeInTheDocument();
    expect(screen.getByText(/1\.0 KB/i)).toBeInTheDocument();
    expect(screen.getByText('ready')).toBeInTheDocument();
  });

  it('deletes document on click', async () => {
    const onDeleted = vi.fn();
    render(<DocumentList documents={[doc]} onDeleted={onDeleted} />);
    await userEvent.click(screen.getByRole('button'));
    await vi.waitFor(() => expect(onDeleted).toHaveBeenCalled());
  });
});
