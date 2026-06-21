import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { McpServerData } from '../mcp-server-list';
import { McpServerList } from '../mcp-server-list';

const noop = vi.fn();

const SERVERS: McpServerData[] = [
  {
    id: 's1', userId: 'u1', name: 'google-calendar', description: 'Google Calendar',
    command: 'npx', args: ['-y', '@modelcontextprotocol/google-calendar'],
    env: {}, isActive: true, isBuiltIn: true, visibility: 'always',
    healthCheck: undefined, createdAt: '2024-01-01', updatedAt: '2024-01-01',
  },
  {
    id: 's2', userId: 'u1', name: 'custom-mcp', description: undefined,
    command: '/usr/local/bin/my-mcp', args: [],
    env: {}, isActive: false, isBuiltIn: false, visibility: 'on-demand',
    healthCheck: undefined, createdAt: '2024-01-01', updatedAt: '2024-01-01',
  },
];

describe('McpServerList', () => {
  it('renders server names', () => {
    render(<McpServerList servers={SERVERS} onToggle={noop} onDelete={noop} />);
    expect(screen.getByText('google-calendar')).toBeInTheDocument();
    expect(screen.getByText('custom-mcp')).toBeInTheDocument();
  });

  it('shows empty state when no servers', () => {
    render(<McpServerList servers={[]} onToggle={noop} onDelete={noop} />);
    expect(screen.getByText(/no mcp servers/i)).toBeInTheDocument();
  });

  it('calls onToggle when switch clicked', async () => {
    const toggle = vi.fn();
    render(<McpServerList servers={SERVERS} onToggle={toggle} onDelete={noop} />);
    const switches = screen.getAllByRole('switch');
    await userEvent.click(switches[0]!);
    expect(toggle).toHaveBeenCalledWith('s1', false);
  });

  it('shows built-in badge for built-in servers', () => {
    render(<McpServerList servers={SERVERS} onToggle={noop} onDelete={noop} />);
    expect(screen.getByText('built-in')).toBeInTheDocument();
  });

  it('shows delete button only for non-built-in servers', () => {
    render(<McpServerList servers={SERVERS} onToggle={noop} onDelete={noop} />);
    const deleteButtons = screen.getAllByLabelText('Delete server');
    expect(deleteButtons).toHaveLength(1);
  });

  it('calls onDelete for non-built-in server', async () => {
    const del = vi.fn();
    render(<McpServerList servers={SERVERS} onToggle={noop} onDelete={del} />);
    await userEvent.click(screen.getByLabelText('Delete server'));
    expect(del).toHaveBeenCalledWith('s2');
  });
});
