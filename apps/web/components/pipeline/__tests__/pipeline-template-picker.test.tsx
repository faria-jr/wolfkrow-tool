import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { PipelineTemplatePicker } from '../pipeline-template-picker';

describe('PipelineTemplatePicker', () => {
  it('renders template names', () => {
    const onSelect = vi.fn();
    render(<PipelineTemplatePicker onSelect={onSelect} />);
    expect(screen.getByText('Security Audit')).toBeDefined();
    expect(screen.getByText('Architecture Review')).toBeDefined();
    expect(screen.getByText('Feature Pipeline')).toBeDefined();
  });

  it('calls onSelect with template id when button clicked', async () => {
    const onSelect = vi.fn();
    render(<PipelineTemplatePicker onSelect={onSelect} />);
    await userEvent.click(screen.getAllByRole('button', { name: /use/i })[0]);
    expect(onSelect).toHaveBeenCalledWith(expect.any(String));
  });
});
