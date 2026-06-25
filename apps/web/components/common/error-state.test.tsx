import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ErrorState } from './error-state';

describe('ErrorState', () => {
  it('renders the title', () => {
    render(<ErrorState title="Something went wrong" />);
    expect(screen.getByText('Something went wrong')).toBeDefined();
  });

  it('renders the description when provided', () => {
    render(<ErrorState title="Error" description="Failed to load agents." />);
    expect(screen.getByText('Failed to load agents.')).toBeDefined();
  });

  it('omits the retry button when onRetry is not provided', () => {
    render(<ErrorState title="Error" />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('renders and triggers the retry button', async () => {
    const onRetry = vi.fn();
    const user = (await import('@testing-library/user-event')).default.setup();
    render(<ErrorState title="Error" onRetry={onRetry} />);

    await user.click(screen.getByRole('button', { name: /try again|retry/i }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('renders the icon when provided', () => {
    render(<ErrorState title="Error" icon={<span data-testid="icon" />} />);
    expect(screen.getByTestId('icon')).toBeDefined();
  });
});
