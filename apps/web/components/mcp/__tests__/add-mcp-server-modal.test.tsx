import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { AddMcpServerModal } from '../add-mcp-server-modal';

describe('AddMcpServerModal', () => {
  const onDone = vi.fn();

  beforeEach(() => {
    onDone.mockClear();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));
  });

  it('renders trigger button', () => {
    render(<AddMcpServerModal onDone={onDone} />);
    expect(screen.getByRole('button', { name: /add server/i })).toBeDefined();
  });

  it('opens dialog on trigger click', async () => {
    render(<AddMcpServerModal onDone={onDone} />);
    await userEvent.click(screen.getByRole('button', { name: /add server/i }));
    expect(screen.getByRole('dialog')).toBeDefined();
    expect(screen.getByLabelText(/name/i)).toBeDefined();
    expect(screen.getByLabelText(/command/i)).toBeDefined();
  });

  it('submits form and calls onDone', async () => {
    render(<AddMcpServerModal onDone={onDone} />);
    await userEvent.click(screen.getByRole('button', { name: /add server/i }));
    await userEvent.type(screen.getByLabelText(/name/i), 'My Server');
    await userEvent.type(screen.getByLabelText(/command/i), 'npx my-mcp');
    await userEvent.click(screen.getByRole('button', { name: /^add$/i }));
    expect(fetch).toHaveBeenCalledWith(
      '/api/mcp-servers',
      expect.objectContaining({ method: 'POST' })
    );
    expect(onDone).toHaveBeenCalled();
  });
});
