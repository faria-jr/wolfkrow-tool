import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { PageHeader } from './page-header';

describe('PageHeader', () => {
  it('renders the title', () => {
    render(<PageHeader title="Agents" />);
    expect(screen.getByRole('heading', { level: 1, name: 'Agents' })).toBeDefined();
  });

  it('renders the description when provided', () => {
    render(<PageHeader title="Agents" description="Manage your agents" />);
    expect(screen.getByText('Manage your agents')).toBeDefined();
  });

  it('omits description when not provided', () => {
    render(<PageHeader title="Agents" />);
    expect(screen.queryByText('Manage your agents')).toBeNull();
  });

  it('renders the icon when provided', () => {
    render(<PageHeader title="Agents" icon={<span data-testid="icon" />} />);
    expect(screen.getByTestId('icon')).toBeDefined();
  });

  it('renders the actions slot when provided', () => {
    render(
      <PageHeader
        title="Agents"
        actions={
          <button type="button" onClick={vi.fn()}>
            New
          </button>
        }
      />
    );
    expect(screen.getByRole('button', { name: 'New' })).toBeDefined();
  });
});
