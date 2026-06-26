import type { ProviderFormValues } from './schema';

const DEFAULT_FORM_VALUES: ProviderFormValues = {
  id: '',
  displayName: '',
  protocol: 'openai-compatible',
  baseUrl: '',
  apiKeyAccount: '',
  models: [],
  supportsTools: false,
};

export function slugifyProviderId(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function buildProviderFormValues(initial?: Partial<ProviderFormValues>): ProviderFormValues {
  return { ...DEFAULT_FORM_VALUES, ...initial };
}

export function resolveProviderId(values: ProviderFormValues, initialId?: string): ProviderFormValues {
  if (initialId?.trim()) return { ...values, id: initialId };
  return { ...values, id: values.id || slugifyProviderId(values.displayName) };
}