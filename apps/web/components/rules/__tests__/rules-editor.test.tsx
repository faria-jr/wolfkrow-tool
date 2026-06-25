import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { RulesEditor } from '../rules-editor';

describe('RulesEditor', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ rules: [{ id: 'r1', kind: 'behavior', title: 'Always polite', body: 'be nice', enabled: true, sortOrder: 0 }] }),
    } as Response);
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('renders rule groups headers', async () => {
    render(<RulesEditor />);
    expect(screen.getByText('Behavior')).toBeInTheDocument();
    expect(screen.getByText('Soul')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add Rule' })).toBeInTheDocument();
    // settle the mount-time fetch inside this test's act() boundary
    await waitFor(() => expect(screen.getByText('Always polite')).toBeInTheDocument());
  });

  it('loads existing rules', async () => {
    render(<RulesEditor />);
    await waitFor(() => expect(screen.getByText('Always polite')).toBeInTheDocument());
  });

  it('shows create form on Add Rule', async () => {
    render(<RulesEditor />);
    await userEvent.click(screen.getByRole('button', { name: 'Add Rule' }));
    expect(screen.getByText('New Rule')).toBeInTheDocument();
  });
});
