import { render, screen } from '@testing-library/react';
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
  it('renders heading', () => {
    render(<EnrichView />);
    expect(screen.getByRole('heading', { name: /enrich/i })).toBeDefined();
  });

  it('shows create form with name input', () => {
    render(<EnrichView />);
    expect(screen.getByPlaceholderText(/session name/i)).toBeDefined();
  });

  it('shows create button', () => {
    render(<EnrichView />);
    expect(screen.getByRole('button', { name: /create/i })).toBeDefined();
  });

  it('loads sessions on mount', async () => {
    render(<EnrichView />);
    const items = await screen.findAllByRole('listitem');
    expect(items.length).toBeGreaterThanOrEqual(2);
  });
});
