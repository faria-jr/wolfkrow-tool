import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { StreamIndicator } from '../stream-indicator';

describe('StreamIndicator', () => {
  it('renders with role=status', () => {
    render(<StreamIndicator />);
    expect(screen.getByRole('status')).toBeTruthy();
  });

  it('has accessible label', () => {
    render(<StreamIndicator />);
    expect(screen.getByLabelText('AI is typing')).toBeTruthy();
  });

  it('renders three animated dots', () => {
    const { container } = render(<StreamIndicator />);
    const dots = container.querySelectorAll('.animate-bounce');
    expect(dots).toHaveLength(3);
  });
});
