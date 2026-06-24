import { z } from 'zod';

export const providerFormSchema = z.object({
  id: z.string().optional(),
  displayName: z.string().min(1, 'Display name required'),
  protocol: z.enum(['anthropic-compat', 'openai-compatible']),
  baseUrl: z.string().url('Must be a valid URL'),
  apiKeyAccount: z.string().min(1, 'API key account required'),
  models: z.array(z.string()).min(1, 'At least one model required'),
  supportsTools: z.boolean(),
  pricingUrl: z.string().url().optional(),
  apiKey: z.string().optional(),
});

export type ProviderFormValues = z.infer<typeof providerFormSchema>;
