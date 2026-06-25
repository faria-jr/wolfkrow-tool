import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { VaultView } from '../vault-view';

describe('VaultView', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ secrets: [{ id: 's1', key: 'anthropic-api-key', displayName: 'Anthropic', category: 'ai', lastRotated: undefined, lastAccessed: undefined }] }),
    } as Response);
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('renders info banner and Add Secret button', async () => {
    render(<VaultView />);
    expect(screen.getByText(/OS Keychain/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add Secret' })).toBeInTheDocument();
    // settle the mount-time fetch inside this test's act() boundary
    await waitFor(() => expect(screen.getByText('Anthropic')).toBeInTheDocument());
  });

  it('loads secrets and shows them', async () => {
    render(<VaultView />);
    await waitFor(() => expect(screen.getByText('Anthropic')).toBeInTheDocument());
  });

  it('opens add secret form', async () => {
    render(<VaultView />);
    await userEvent.click(screen.getByRole('button', { name: 'Add Secret' }));
    expect(screen.getByText('Add Secret')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/anthropic-api-key/i)).toBeInTheDocument();
  });
});
