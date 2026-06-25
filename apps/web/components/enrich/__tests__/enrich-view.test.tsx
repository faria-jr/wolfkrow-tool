import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { EnrichView } from '../enrich-view';

const mockSessions = [
  { id: 's1', name: 'Session 1', status: 'pending', createdAt: '2024-01-01T00:00:00Z' },
  { id: 's2', name: 'Session 2', status: 'enriched', createdAt: '2024-01-02T00:00:00Z' },
];

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ sessions: mockSessions }),
  }));
});

describe('EnrichView', () => {
  it('renders heading', async () => {
    render(<EnrichView />);
    expect(screen.getByRole('heading', { name: /enrich/i })).toBeDefined();
    // settle the mount-time fetch inside this test's act() boundary
    await screen.findAllByRole('listitem');
  });

  it('shows create form with name input', async () => {
    render(<EnrichView />);
    expect(screen.getByPlaceholderText(/session name/i)).toBeDefined();
    await screen.findAllByRole('listitem');
  });

  it('shows create button', async () => {
    render(<EnrichView />);
    expect(screen.getByRole('button', { name: /create/i })).toBeDefined();
    await screen.findAllByRole('listitem');
  });

  it('loads sessions on mount', async () => {
    render(<EnrichView />);
    const items = await screen.findAllByRole('listitem');
    expect(items.length).toBeGreaterThanOrEqual(2);
  });

  it('renders Edit Spec button for each session', async () => {
    render(<EnrichView />);
    await screen.findAllByRole('listitem');
    const editSpecButtons = screen.getAllByRole('button', { name: /edit spec/i });
    expect(editSpecButtons.length).toBe(2);
  });

  it('renders spec textarea when Edit Spec is clicked', async () => {
    const user = userEvent.setup();
    render(<EnrichView />);
    await screen.findAllByRole('listitem');
    const [firstEditSpec] = screen.getAllByRole('button', { name: /edit spec/i });
    await user.click(firstEditSpec!);
    expect(screen.getByPlaceholderText(/paste your specification here/i)).toBeDefined();
  });

  it('hides spec textarea when Edit Spec is clicked again (toggle)', async () => {
    const user = userEvent.setup();
    render(<EnrichView />);
    await screen.findAllByRole('listitem');
    const [firstEditSpec] = screen.getAllByRole('button', { name: /edit spec/i });
    await user.click(firstEditSpec!);
    expect(screen.getByPlaceholderText(/paste your specification here/i)).toBeDefined();
    await user.click(firstEditSpec!);
    expect(screen.queryByPlaceholderText(/paste your specification here/i)).toBeNull();
  });

  it('validate sends specContent in request body', async () => {
    const user = userEvent.setup();
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ sessions: mockSessions }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ output: 'validator result' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ sessions: mockSessions }) });
    vi.stubGlobal('fetch', mockFetch);

    render(<EnrichView />);
    await screen.findAllByRole('listitem');

    const [firstEditSpec] = screen.getAllByRole('button', { name: /edit spec/i });
    await user.click(firstEditSpec!);

    const textarea = screen.getByPlaceholderText(/paste your specification here/i);
    await user.type(textarea, 'my spec content');

    const [firstValidate] = screen.getAllByRole('button', { name: /^validate$/i });
    await user.click(firstValidate!);

    await waitFor(() => {
      const calls = mockFetch.mock.calls;
      const validateCall = calls.find((c) => (c[0] as string).includes('/validate'));
      expect(validateCall).toBeDefined();
      const body = JSON.parse((validateCall![1] as RequestInit).body as string);
      expect(body.specContent).toBe('my spec content');
    });
  });

  it('shows validator output after validate', async () => {
    const user = userEvent.setup();
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ sessions: mockSessions }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ output: 'validator result text' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ sessions: mockSessions }) });
    vi.stubGlobal('fetch', mockFetch);

    render(<EnrichView />);
    await screen.findAllByRole('listitem');

    const [firstValidate] = screen.getAllByRole('button', { name: /^validate$/i });
    await user.click(firstValidate!);

    await screen.findByText('validator result text');
  });

  it('shows enricher output after enrich', async () => {
    const user = userEvent.setup();
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ sessions: mockSessions }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ enriched: 'enriched result text' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ sessions: mockSessions }) });
    vi.stubGlobal('fetch', mockFetch);

    render(<EnrichView />);
    await screen.findAllByRole('listitem');

    const [firstEnrich] = screen.getAllByRole('button', { name: /^enrich$/i });
    await user.click(firstEnrich!);

    await screen.findByText('enriched result text');
  });
});
