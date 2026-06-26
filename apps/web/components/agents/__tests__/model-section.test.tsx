import { zodResolver } from '@hookform/resolvers/zod';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm } from 'react-hook-form';
import { beforeAll, describe, expect, it } from 'vitest';


import type { ProviderDTO } from '../model-section';
import { ModelSection } from '../model-section';
import { agentSchema, type AgentFormValues } from '../schema';

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
  {
    id: 'anthropic',
    displayName: 'Anthropic (Claude)',
    protocol: 'anthropic-compat',
    baseUrl: 'https://api.anthropic.com',
    apiKeyAccount: 'anthropic',
    models: ['claude-opus-4-8', 'claude-sonnet-4-6'],
    supportsTools: true,
  },
  {
    id: 'openai',
    displayName: 'OpenAI',
    protocol: 'openai-compatible',
    baseUrl: 'https://api.openai.com/v1',
    apiKeyAccount: 'openai',
    models: ['gpt-4o', 'gpt-4.1'],
    supportsTools: true,
  },
  {
    id: 'ollama',
    displayName: 'Ollama (local)',
    protocol: 'openai-compatible',
    baseUrl: 'http://localhost:11434/v1',
    apiKeyAccount: 'ollama',
    models: ['llama3', 'mistral'],
    supportsTools: false,
  },
  {
    id: 'openrouter',
    displayName: 'OpenRouter',
    protocol: 'openai-compatible',
    baseUrl: 'https://openrouter.ai/api/v1',
    apiKeyAccount: 'openrouter',
    models: ['openrouter/auto'],
    supportsTools: true,
  },
];

function Wrapper({ providers, runtime }: { providers?: ProviderDTO[]; runtime?: AgentFormValues['runtime'] }) {
  const form = useForm<AgentFormValues>({
    resolver: zodResolver(agentSchema),
    defaultValues: { ...defaultValues, ...(runtime ? { runtime } : {}) },
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

    const runtimeSelect = screen.getByRole('combobox', { name: /runtime/i });
    await user.click(runtimeSelect);
    const compatOption = await screen.findByRole('option', { name: 'claude-compat' });
    await user.click(compatOption);

    const providerSelect = await screen.findByRole('combobox', { name: /provider/i });
    await user.click(providerSelect);
    const zaiOption = await screen.findByRole('option', { name: 'Z.ai' });
    await user.click(zaiOption);

    const modelSelect = screen.getByRole('combobox', { name: /model/i });
    await user.click(modelSelect);
    expect(await screen.findByRole('option', { name: 'glm-4.7' })).toBeTruthy();
    expect(await screen.findByRole('option', { name: 'glm-5.1' })).toBeTruthy();
  });

  it('resets the model to the new provider first model when provider changes (EPIC 3.3)', async () => {
    const user = userEvent.setup();
    render(<Wrapper providers={customProviders} />);

    // default model is 'claude-sonnet-4-6', which is NOT in Z.ai's models.
    const runtimeSelect = screen.getByRole('combobox', { name: /runtime/i });
    await user.click(runtimeSelect);
    await user.click(await screen.findByRole('option', { name: 'claude-compat' }));

    const providerSelect = await screen.findByRole('combobox', { name: /provider/i });
    await user.click(providerSelect);
    await user.click(await screen.findByRole('option', { name: 'Z.ai' }));

    // model should have auto-reset to Z.ai's first model (glm-4.7).
    const modelTrigger = screen.getByRole('combobox', { name: /^model/i });
    expect(modelTrigger).toHaveTextContent('glm-4.7');
  });

  // EPIC 1.1 — provider selector visible for every runtime (was gated to claude-compat).
  it('shows provider selector for cloud runtime (anthropic-compat providers only)', async () => {
    const user = userEvent.setup();
    render(<Wrapper providers={customProviders} runtime="cloud" />);
    const providerSelect = screen.getByRole('combobox', { name: /provider/i });
    await user.click(providerSelect);
    expect(await screen.findByRole('option', { name: 'Anthropic (Claude)' })).toBeTruthy();
    expect(await screen.findByRole('option', { name: 'Z.ai' })).toBeTruthy();
    expect(screen.queryByRole('option', { name: 'Ollama (local)' })).toBeNull();
    expect(screen.queryByRole('option', { name: 'OpenAI' })).toBeNull();
    await user.keyboard('{Escape}');
  });

  it('shows provider selector for local runtime (openai-compatible only — Ollama)', async () => {
    const user = userEvent.setup();
    render(<Wrapper providers={customProviders} runtime="local" />);
    const providerSelect = screen.getByRole('combobox', { name: /provider/i });
    await user.click(providerSelect);
    expect(await screen.findByRole('option', { name: 'Ollama (local)' })).toBeTruthy();
    expect(screen.queryByRole('option', { name: 'Z.ai' })).toBeNull();
    expect(screen.queryByRole('option', { name: 'Anthropic (Claude)' })).toBeNull();
    await user.keyboard('{Escape}');
  });

  it('shows provider selector for codex runtime (openai-compatible — OpenAI)', async () => {
    const user = userEvent.setup();
    render(<Wrapper providers={customProviders} runtime="codex" />);
    const providerSelect = screen.getByRole('combobox', { name: /provider/i });
    await user.click(providerSelect);
    expect(await screen.findByRole('option', { name: 'OpenAI' })).toBeTruthy();
    expect(screen.queryByRole('option', { name: 'Z.ai' })).toBeNull();
    await user.keyboard('{Escape}');
  });

  it('shows provider selector for external runtime (openai-compatible — OpenRouter)', async () => {
    const user = userEvent.setup();
    render(<Wrapper providers={customProviders} runtime="external" />);
    const providerSelect = screen.getByRole('combobox', { name: /provider/i });
    await user.click(providerSelect);
    expect(await screen.findByRole('option', { name: 'OpenRouter' })).toBeTruthy();
    expect(screen.queryByRole('option', { name: 'Anthropic (Claude)' })).toBeNull();
    await user.keyboard('{Escape}');
  });

  it('shows provider selector for claude-compat runtime (anthropic-compat excluding anthropic itself)', async () => {
    const user = userEvent.setup();
    render(<Wrapper providers={customProviders} runtime="claude-compat" />);
    const providerSelect = screen.getByRole('combobox', { name: /provider/i });
    await user.click(providerSelect);
    expect(await screen.findByRole('option', { name: 'Z.ai' })).toBeTruthy();
    expect(screen.queryByRole('option', { name: 'Anthropic (Claude)' })).toBeNull();
    await user.keyboard('{Escape}');
  });

  it('replaces default models with selected provider models when provider changes on cloud runtime', async () => {
    const user = userEvent.setup();
    render(<Wrapper providers={customProviders} runtime="cloud" />);

    const modelSelect = screen.getByRole('combobox', { name: /^model/i });
    await user.click(modelSelect);
    expect(await screen.findByRole('option', { name: 'claude-opus-4-8' })).toBeTruthy();
    await user.keyboard('{Escape}');

    // Pick Z.ai as provider — model list should reset to glm-4.7.
    const providerSelect = screen.getByRole('combobox', { name: /provider/i });
    await user.click(providerSelect);
    await user.click(await screen.findByRole('option', { name: 'Z.ai' }));

    await user.click(modelSelect);
    expect(await screen.findByRole('option', { name: 'glm-4.7' })).toBeTruthy();
    expect(screen.queryByRole('option', { name: 'claude-opus-4-8' })).toBeNull();
  });
});
