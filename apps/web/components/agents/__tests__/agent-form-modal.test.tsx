import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AgentFormModal } from '../agent-form-modal';

const onSubmit = vi.fn();
const onClose = vi.fn();

const defaultAgent = {
  id: 'a1',
  name: 'test-agent',
  description: 'A test agent',
  model: 'claude-sonnet-4-6',
  effort: 'medium' as const,
  thinking: false,
  maxTurns: 10,
  allowedTools: [] as string[],
  mcpServers: [] as string[],
  isActive: true,
  skills: [] as string[],
  runtime: 'cloud' as const,
  systemPrompt: 'You are helpful.',
};

function makeQC() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function Providers({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={makeQC()}>{children}</QueryClientProvider>;
}

function renderWithQuery(ui: React.ReactElement) {
  return render(ui, { wrapper: Providers });
}

describe('AgentFormModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders modal with title when open', () => {
    renderWithQuery(<AgentFormModal open onClose={onClose} onSubmit={onSubmit} />);
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText(/new agent/i)).toBeTruthy();
  });

  it('renders edit title when agent provided', () => {
    renderWithQuery(
      <AgentFormModal open onClose={onClose} onSubmit={onSubmit} agent={defaultAgent} />
    );
    expect(screen.getByText(/edit agent/i)).toBeTruthy();
  });

  it('does not render when closed', () => {
    renderWithQuery(<AgentFormModal open={false} onClose={onClose} onSubmit={onSubmit} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('pre-fills name from agent prop', () => {
    renderWithQuery(
      <AgentFormModal open onClose={onClose} onSubmit={onSubmit} agent={defaultAgent} />
    );
    const nameInput = screen.getByLabelText(/name/i) as HTMLInputElement;
    expect(nameInput.value).toBe('test-agent');
  });

  it('shows validation error for empty name on submit', async () => {
    const user = userEvent.setup();
    renderWithQuery(<AgentFormModal open onClose={onClose} onSubmit={onSubmit} />);
    await user.click(screen.getByRole('button', { name: /save/i }));
    await waitFor(() => {
      expect(screen.getByText(/name is required/i)).toBeTruthy();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('calls onSubmit with form data when valid', async () => {
    const user = userEvent.setup();
    renderWithQuery(<AgentFormModal open onClose={onClose} onSubmit={onSubmit} />);
    await user.type(screen.getByLabelText(/name/i), 'my-new-agent');
    await user.click(screen.getByRole('button', { name: /save/i }));
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledOnce();
    });
    const call = onSubmit.mock.calls[0]?.[0] as { name: string };
    expect(call.name).toBe('my-new-agent');
  });

  it('calls onClose when cancel clicked', async () => {
    const user = userEvent.setup();
    renderWithQuery(<AgentFormModal open onClose={onClose} onSubmit={onSubmit} />);
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
