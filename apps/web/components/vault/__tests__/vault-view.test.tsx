import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { VaultView } from '../vault-view';

const VALID_UUID = '12345678-1234-4123-8123-123456789012';

describe('VaultView', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // FE-4: api-client uses .text() + JSON.parse + SecretMetadataSchema.parse.
    // Secret shape must satisfy the shared schema (userId, metadata, timestamps).
    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        secrets: [{
          id: VALID_UUID,
          userId: VALID_UUID,
          key: 'anthropic-api-key',
          displayName: 'Anthropic',
          category: 'ai',
          metadata: {},
          createdAt: '2026-06-01T00:00:00Z',
          updatedAt: '2026-06-01T00:00:00Z',
        }],
      }),
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
