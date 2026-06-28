import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ProviderFormModal } from '../provider-form-modal';

describe('ProviderFormModal', () => {
  it('renders all required fields', () => {
    render(<ProviderFormModal open onSave={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByLabelText(/display name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/base url/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/api key account/i)).toBeInTheDocument();
  });

  it('submits a valid custom provider', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<ProviderFormModal open onSave={onSave} onClose={vi.fn()} />);

    await user.clear(screen.getByLabelText(/display name/i));
    await user.type(screen.getByLabelText(/display name/i), 'My LLM');
    await user.clear(screen.getByLabelText(/base url/i));
    await user.type(screen.getByLabelText(/base url/i), 'https://my/v1');
    await user.clear(screen.getByLabelText(/api key account/i));
    await user.type(screen.getByLabelText(/api key account/i), 'my-llm');

    const modelsInput = screen.getByLabelText(/^models$/i);
    await user.clear(modelsInput);
    await user.type(modelsInput, 'model-a');
    await user.click(screen.getByRole('button', { name: /add model/i }));

    await user.click(screen.getByRole('button', { name: /save/i }));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        displayName: 'My LLM',
        baseUrl: 'https://my/v1',
        models: ['model-a'],
      })
    );
  });

  it('calls onClose when Cancel is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<ProviderFormModal open onSave={vi.fn()} onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onClose).toHaveBeenCalled();
  });
});
