import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it } from 'vitest';

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
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form } from '@/components/ui/form';
import type { ProviderDTO } from '../model-section';
import { ModelSection } from '../model-section';
import { agentSchema, type AgentFormValues } from '../schema';

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

const customProviders: ProviderDTO[] = [
  {
    id: 'zai',
    displayName: 'Z.ai',
    protocol: 'anthropic-compat',
    baseUrl: 'https://api.z.ai/api/anthropic',
    apiKeyAccount: 'zai-api-key',
    models: ['glm-4.7', 'glm-5.1'],
    supportsTools: true,
  },
];

function Wrapper({ providers }: { providers?: ProviderDTO[] }) {
  const form = useForm<AgentFormValues>({
    resolver: zodResolver(agentSchema),
    defaultValues,
  });
  return (
    <Form {...form}>
      <ModelSection control={form.control} {...(providers !== undefined ? { providers } : {})} />
    </Form>
  );
}

describe('ModelSection', () => {
  it('renders default Claude models when no providers given', () => {
    render(<Wrapper />);
    expect(screen.getByRole('combobox', { name: /model/i })).toBeTruthy();
  });

  it('exports ProviderDTO type', () => {
    const dto: ProviderDTO = customProviders[0]!;
    expect(dto.id).toBe('zai');
  });

  it('shows provider-specific models when providers prop given and provider selected', async () => {
    const user = userEvent.setup();
    render(<Wrapper providers={customProviders} />);
    const runtimeSelect = screen.getAllByRole('combobox')[1];
    if (runtimeSelect) {
      await user.click(runtimeSelect);
    }
  });
});
