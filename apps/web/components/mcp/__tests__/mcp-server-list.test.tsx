import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { McpServerData } from '../mcp-server-list';
import { McpServerList } from '../mcp-server-list';

const noop = vi.fn();

function makeServer(overrides: Partial<McpServerData> = {}): McpServerData {
  return {
    id: 's1',
    userId: 'u1',
    name: 'google-calendar',
    description: 'Google Calendar',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/google-calendar'],
    env: {},
    isActive: true,
    isBuiltIn: true,
    visibility: 'always',
    healthCheck: undefined,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
    source: 'built-in',
    ...overrides,
  };
}

describe('McpServerList', () => {
  it('renders server names', () => {
    const servers: McpServerData[] = [
      makeServer({ id: 's1', name: 'google-calendar' }),
      makeServer({
        id: 's2',
        name: 'custom-mcp',
        isBuiltIn: false,
        source: 'custom',
        isActive: false,
        visibility: 'on-demand',
      }),
    ];
    render(
      <McpServerList
        servers={servers}
        onToggle={noop}
        onDelete={noop}
        onRestart={noop}
        onHealthCheck={noop}
        onVisibilityChange={noop}
      />,
    );
    expect(screen.getByText('google-calendar')).toBeInTheDocument();
    expect(screen.getByText('custom-mcp')).toBeInTheDocument();
  });

  it('shows empty state when no servers', () => {
    render(
      <McpServerList
        servers={[]}
        onToggle={noop}
        onDelete={noop}
        onRestart={noop}
        onHealthCheck={noop}
        onVisibilityChange={noop}
      />,
    );
    expect(screen.getByText(/no mcp servers/i)).toBeInTheDocument();
  });

  it('calls onToggle when switch clicked', async () => {
    const toggle = vi.fn();
    render(
      <McpServerList
        servers={[makeServer()]}
        onToggle={toggle}
        onDelete={noop}
        onRestart={noop}
        onHealthCheck={noop}
        onVisibilityChange={noop}
      />,
    );
    const switches = screen.getAllByRole('switch');
    await userEvent.click(switches[0]!);
    expect(toggle).toHaveBeenCalledWith('s1', false);
  });

  it('shows built-in badge for built-in servers', () => {
    render(
      <McpServerList
        servers={[makeServer({ source: 'built-in' })]}
        onToggle={noop}
        onDelete={noop}
        onRestart={noop}
        onHealthCheck={noop}
        onVisibilityChange={noop}
      />,
    );
    expect(screen.getByText('built-in')).toBeInTheDocument();
  });

  it('shows planned badge for planned servers', () => {
    render(
      <McpServerList
        servers={[makeServer({ name: 'higgsfield', source: 'planned', isBuiltIn: true })]}
        onToggle={noop}
        onDelete={noop}
        onRestart={noop}
        onHealthCheck={noop}
        onVisibilityChange={noop}
      />,
    );
    expect(screen.getByText('planned')).toBeInTheDocument();
  });

  it('shows custom badge for non-built-in user-added servers', () => {
    render(
      <McpServerList
        servers={[makeServer({ id: 's2', name: 'my-server', isBuiltIn: false, source: 'custom' })]}
        onToggle={noop}
        onDelete={noop}
        onRestart={noop}
        onHealthCheck={noop}
        onVisibilityChange={noop}
      />,
    );
    const badges = screen.getAllByText(/^custom$/);
    expect(badges.length).toBeGreaterThanOrEqual(1);
  });

  it('shows delete button only for non-built-in servers', () => {
    const servers: McpServerData[] = [
      makeServer({ id: 's1', source: 'built-in' }),
      makeServer({ id: 's2', name: 'custom', isBuiltIn: false, source: 'custom' }),
    ];
    render(
      <McpServerList
        servers={servers}
        onToggle={noop}
        onDelete={noop}
        onRestart={noop}
        onHealthCheck={noop}
        onVisibilityChange={noop}
      />,
    );
    const deleteButtons = screen.getAllByLabelText('Delete server');
    expect(deleteButtons).toHaveLength(1);
  });

  it('calls onDelete for non-built-in server', async () => {
    const del = vi.fn();
    render(
      <McpServerList
        servers={[makeServer({ id: 's2', name: 'custom', isBuiltIn: false, source: 'custom' })]}
        onToggle={noop}
        onDelete={del}
        onRestart={noop}
        onHealthCheck={noop}
        onVisibilityChange={noop}
      />,
    );
    await userEvent.click(screen.getByLabelText('Delete server'));
    expect(del).toHaveBeenCalledWith('s2');
  });

  it('exposes restart and health check actions for built-in servers', () => {
    render(
      <McpServerList
        servers={[makeServer({ source: 'built-in' })]}
        onToggle={noop}
        onDelete={noop}
        onRestart={noop}
        onHealthCheck={noop}
        onVisibilityChange={noop}
      />,
    );
    expect(screen.getByLabelText('Restart server')).toBeInTheDocument();
    expect(screen.getByLabelText('Check health')).toBeInTheDocument();
  });

  it('does not show restart/health actions for custom servers', () => {
    render(
      <McpServerList
        servers={[makeServer({ id: 's2', name: 'custom', isBuiltIn: false, source: 'custom' })]}
        onToggle={noop}
        onDelete={noop}
        onRestart={noop}
        onHealthCheck={noop}
        onVisibilityChange={noop}
      />,
    );
    expect(screen.queryByLabelText('Restart server')).toBeNull();
    expect(screen.queryByLabelText('Check health')).toBeNull();
  });

  it('calls onHealthCheck when health button clicked', async () => {
    const check = vi.fn();
    render(
      <McpServerList
        servers={[makeServer({ source: 'built-in' })]}
        onToggle={noop}
        onDelete={noop}
        onRestart={noop}
        onHealthCheck={check}
        onVisibilityChange={noop}
      />,
    );
    await userEvent.click(screen.getByLabelText('Check health'));
    expect(check).toHaveBeenCalledWith('s1');
  });

  it('calls onRestart when restart button clicked', async () => {
    const restart = vi.fn();
    render(
      <McpServerList
        servers={[makeServer({ source: 'built-in' })]}
        onToggle={noop}
        onDelete={noop}
        onRestart={restart}
        onHealthCheck={noop}
        onVisibilityChange={noop}
      />,
    );
    await userEvent.click(screen.getByLabelText('Restart server'));
    expect(restart).toHaveBeenCalledWith('s1');
  });

  it('shows health badge as healthy when snapshot is healthy', () => {
    render(
      <McpServerList
        servers={[
          makeServer({
            health: {
              status: 'running',
              running: true,
              healthy: true,
              tools: 3,
              restarts: 0,
              latencyMs: 12,
              checkedAt: Date.now(),
            },
          }),
        ]}
        onToggle={noop}
        onDelete={noop}
        onRestart={noop}
        onHealthCheck={noop}
        onVisibilityChange={noop}
      />,
    );
    expect(screen.getByText(/health: ok \(3 tools\)/)).toBeInTheDocument();
  });

  it('shows health badge as crashed when unhealthy', () => {
    render(
      <McpServerList
        servers={[
          makeServer({
            health: {
              status: 'crashed',
              running: false,
              healthy: false,
              tools: 0,
              restarts: 2,
              lastError: 'boom',
              checkedAt: Date.now(),
            },
          }),
        ]}
        onToggle={noop}
        onDelete={noop}
        onRestart={noop}
        onHealthCheck={noop}
        onVisibilityChange={noop}
      />,
    );
    expect(screen.getByText(/health: crashed/)).toBeInTheDocument();
    expect(screen.getByText('boom')).toBeInTheDocument();
  });

  it('renders visibility select for each server', () => {
    render(
      <McpServerList
        servers={[makeServer()]}
        onToggle={noop}
        onDelete={noop}
        onRestart={noop}
        onHealthCheck={noop}
        onVisibilityChange={noop}
      />,
    );
    const select = screen.getByRole('combobox');
    expect(select).toBeInTheDocument();
  });

  it('shows current visibility value in the select trigger', () => {
    render(
      <McpServerList
        servers={[makeServer({ visibility: 'on-demand' })]}
        onToggle={noop}
        onDelete={noop}
        onRestart={noop}
        onHealthCheck={noop}
        onVisibilityChange={noop}
      />,
    );
    expect(screen.getByText(/on-demand \(start when used\)/)).toBeInTheDocument();
  });
});
