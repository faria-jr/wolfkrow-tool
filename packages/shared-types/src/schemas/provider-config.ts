/**
 * Provider config schemas
 */

import { z } from 'zod';

import { NonEmptyStringSchema } from './common';

export const ProviderProtocolSchema = z.enum(['anthropic-compat', 'openai-compatible']);

export type ProviderProtocol = z.infer<typeof ProviderProtocolSchema>;

export const ProviderConfigResponseSchema = z.object({
  id: NonEmptyStringSchema,
  displayName: NonEmptyStringSchema,
  protocol: ProviderProtocolSchema,
  baseUrl: z.string().url(),
  apiKeyAccount: NonEmptyStringSchema,
  models: z.array(NonEmptyStringSchema).min(1),
  supportsTools: z.boolean(),
  pricingUrl: z.string().url().optional(),
  hasApiKey: z.boolean(),
});

export type ProviderConfigResponse = z.infer<typeof ProviderConfigResponseSchema>;
