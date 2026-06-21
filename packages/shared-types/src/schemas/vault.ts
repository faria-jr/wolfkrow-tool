/**
 * Vault schemas — encrypted secrets
 */

import { z } from 'zod';

import {
  MetadataSchema,
  NonEmptyStringSchema,
  ShortStringSchema,
  TimestampSchema,
  UuidSchema,
} from './common';

export const SecretCategorySchema = z.enum(['ai', 'integration', 'oauth', 'other']);

export type SecretCategory = z.infer<typeof SecretCategorySchema>;

/**
 * Secret metadata (value NEVER stored in DB, only in keytar)
 */
export const SecretMetadataSchema = z.object({
  id: UuidSchema,
  userId: UuidSchema,
  key: ShortStringSchema,
  displayName: ShortStringSchema,
  description: z.string().max(500).optional(),
  category: SecretCategorySchema,
  lastAccessed: TimestampSchema.optional(),
  lastRotated: TimestampSchema.optional(),
  metadata: MetadataSchema,
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});

export type SecretMetadata = z.infer<typeof SecretMetadataSchema>;

/**
 * Store secret input (with value, sent over secure channel only)
 */
export const StoreSecretInputSchema = z.object({
  key: ShortStringSchema,
  displayName: ShortStringSchema,
  value: NonEmptyStringSchema,
  description: z.string().max(500).optional(),
  category: SecretCategorySchema,
  metadata: MetadataSchema.default({}),
});

export type StoreSecretInput = z.infer<typeof StoreSecretInputSchema>;

/**
 * Update secret input (value optional — if not provided, value is unchanged)
 */
export const UpdateSecretInputSchema = z.object({
  displayName: ShortStringSchema.optional(),
  value: NonEmptyStringSchema.optional(),
  description: z.string().max(500).optional(),
  category: SecretCategorySchema.optional(),
  metadata: MetadataSchema.optional(),
});

export type UpdateSecretInput = z.infer<typeof UpdateSecretInputSchema>;
