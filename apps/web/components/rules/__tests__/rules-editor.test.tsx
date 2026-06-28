import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRouter } from 'next/navigation';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('next/navigation', () => ({ useRouter: vi.fn() }));

import { RulesEditor } from '../rules-editor';

describe('RulesEditor', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let push: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    push = vi.fn();
    vi.mocked(useRouter).mockReturnValue({ push } as unknown as ReturnType<typeof useRouter>);
    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        rules: [
          {
            id: 'r1',
            kind: 'behavior',
            title: 'Always polite',
            body: 'be nice',
            enabled: true,
            sortOrder: 0,
          },
        ],
      }),
    } as Response);
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('renders rules in the shared table pattern', async () => {
    render(<RulesEditor />);
    await waitFor(() => expect(screen.getByText('Always polite')).toBeInTheDocument());

    expect(screen.getByRole('columnheader', { name: /name/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /type/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /status/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New rule' })).toBeInTheDocument();
  });

  it('loads existing rules', async () => {
    render(<RulesEditor />);
    await waitFor(() => expect(screen.getByText('Always polite')).toBeInTheDocument());
  });

  it('navigates to the dedicated create screen', async () => {
    render(<RulesEditor />);
    await waitFor(() => expect(screen.getByText('Always polite')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: 'New rule' }));

    expect(push).toHaveBeenCalledWith('/rules/new');
  });

  it('navigates to the dedicated edit screen', async () => {
    render(<RulesEditor />);
    await waitFor(() => expect(screen.getByText('Always polite')).toBeInTheDocument());

    await userEvent.click(screen.getByLabelText('Edit rule'));

    expect(push).toHaveBeenCalledWith('/rules/r1/edit');
  });

  it('duplicates a rule from the table action', async () => {
    render(<RulesEditor />);
    await waitFor(() => expect(screen.getByText('Always polite')).toBeInTheDocument());

    await userEvent.click(screen.getByLabelText('Duplicate rule'));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/rules',
        expect.objectContaining({ method: 'POST' })
      );
    });
  });
});
