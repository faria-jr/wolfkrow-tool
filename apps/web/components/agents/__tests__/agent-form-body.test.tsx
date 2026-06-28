import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm } from 'react-hook-form';
import { beforeAll, describe, expect, it } from 'vitest';

import { AgentFormBody } from '../agent-form-body';
import { type AgentFormValues } from '../schema';

import { Form } from '@/components/ui/form';

beforeAll(() => {
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = () => false;
  }
  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = () => undefined;
  }
  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = () => undefined;
  }
});

const defaultValues: AgentFormValues = {
  name: 'test',
  description: '',
  model: 'claude-sonnet-4-6',
  effort: 'medium',
  thinking: false,
  maxTurns: 10,
  allowedTools: [],
  mcpServers: [],
  isActive: true,
  skills: [],
  runtime: 'cloud',
  systemPrompt: '',
};

function makeQC() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function Providers({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={makeQC()}>{children}</QueryClientProvider>;
}

function Wrapper({ values }: { values?: Partial<AgentFormValues> }) {
  const form = useForm<AgentFormValues>({
    defaultValues: { ...defaultValues, ...values },
  });
  return (
    <Providers>
      <Form {...form}>
        <AgentFormBody control={form.control} />
      </Form>
    </Providers>
  );
}

describe('AgentFormBody — system prompt markdown editor (EPIC 1.1)', () => {
  it('renders MarkdownEditor tabs (Edit/Preview) instead of a plain textarea', () => {
    render(<Wrapper />);
    expect(screen.getByRole('tab', { name: /edit/i })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /preview/i })).toBeTruthy();
    expect(screen.getByLabelText(/system prompt/i)).toBeTruthy();
  });

  it('pre-fills editor with the existing system prompt value', () => {
    render(<Wrapper values={{ systemPrompt: '# Existing agent\n\nYou are great.' }} />);
    const textarea = screen.getByLabelText(/system prompt/i) as HTMLTextAreaElement;
    expect(textarea.value).toBe('# Existing agent\n\nYou are great.');
  });

  it('typing in the editor updates the value via onChange', async () => {
    const user = userEvent.setup();
    render(<Wrapper />);
    const textarea = screen.getByLabelText(/system prompt/i) as HTMLTextAreaElement;
    await user.clear(textarea);
    await user.type(textarea, 'New prompt body');
    expect(textarea.value).toBe('New prompt body');
  });
});
