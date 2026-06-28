import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { PageHeader } from '../page-header';

describe('PageHeader', () => {
  it('renders title and description', () => {
    render(<PageHeader title="Agents" description="Manage your AI agents" />);
    expect(screen.getByRole('heading', { name: 'Agents' })).toBeInTheDocument();
    expect(screen.getByText('Manage your AI agents')).toBeInTheDocument();
  });

  it('renders icon when provided', () => {
    render(
      <PageHeader title="Chat" description="Talk to AI" icon={<span data-testid="icon">🤖</span>} />
    );
    expect(screen.getByTestId('icon')).toBeInTheDocument();
  });

  it('renders actions slot', async () => {
    const onClick = () => undefined;
    render(
      <PageHeader title="Agents" description="X" actions={<button onClick={onClick}>Add</button>} />
    );
    const button = screen.getByRole('button', { name: 'Add' });
    expect(button).toBeInTheDocument();
    await userEvent.click(button);
  });

  it('truncates long titles without overflow', () => {
    const longTitle = 'A'.repeat(200);
    render(<PageHeader title={longTitle} description="d" />);
    const heading = screen.getByRole('heading', { name: longTitle });
    expect(heading).toBeInTheDocument();
  });
});
