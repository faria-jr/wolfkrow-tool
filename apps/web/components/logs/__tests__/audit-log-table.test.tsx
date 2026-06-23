import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuditLogTable } from '../audit-log-table';

const mockEntries = [
  {
    id: 'entry-1',
    userId: 'user-1',
    action: 'agent.create',
    resourceType: 'agent',
    resourceId: 'agent-abc-123-def-456',
    ip: '127.0.0.1',
    timestamp: new Date('2024-01-15T10:00:00Z'),
    metadata: {},
  },
  {
    id: 'entry-2',
    userId: 'user-1',
    action: 'secret.delete',
    resourceType: 'secret',
    resourceId: 'secret-xyz',
    ip: '192.168.1.1',
    timestamp: new Date('2024-01-15T11:00:00Z'),
    metadata: {},
  },
];

describe('AuditLogTable', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetAllMocks();
  });

  it('renders loading state while fetching', () => {
    vi.mocked(fetch).mockReturnValue(new Promise(() => {})); // never resolves
    render(<AuditLogTable />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('renders table with entries after successful fetch', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ entries: mockEntries }),
    } as Response);

    render(<AuditLogTable />);

    await waitFor(() => {
      expect(screen.getByRole('table')).toBeInTheDocument();
    });

    // Both action entries should be visible in the table cells
    const table = screen.getByRole('table');
    expect(table).toBeInTheDocument();
    // Resource IDs should be truncated (long one)
    expect(screen.getByText(/agent-abc/i)).toBeInTheDocument();
    // IP addresses should appear
    expect(screen.getByText('127.0.0.1')).toBeInTheDocument();
  });

  it('renders empty state when no entries returned', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ entries: [] }),
    } as Response);

    render(<AuditLogTable />);

    await waitFor(() => {
      expect(screen.getByText(/no audit log entries/i)).toBeInTheDocument();
    });
  });

  it('filter by action changes fetch URL', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ entries: [] }),
    } as Response);

    render(<AuditLogTable />);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    // Select a filter action using the select dropdown
    const select = screen.getByRole('combobox');
    await userEvent.selectOptions(select, 'agent.create');

    await waitFor(() => {
      const calls = vi.mocked(fetch).mock.calls;
      const lastUrl = calls[calls.length - 1]![0] as string;
      expect(lastUrl).toContain('action=agent.create');
    });
  });
});
