/**
 * Channels schemas — Telegram, Discord, Slack integrations
 */

import { z } from 'zod';

import {
  MetadataSchema,
  ShortStringSchema,
  TimestampSchema,
  UuidSchema,
} from './common';

export const ChannelTypeSchema = z.enum(['telegram', 'discord', 'slack', 'whatsapp']);

export type ChannelType = z.infer<typeof ChannelTypeSchema>;

export const ChannelStatusSchema = z.enum(['connected', 'disconnected', 'error', 'pairing']);

export type ChannelStatus = z.infer<typeof ChannelStatusSchema>;

/**
 * Channel configuration
 */
export const ChannelSchema = z.object({
  id: UuidSchema,
  userId: UuidSchema,
  type: ChannelTypeSchema,
  name: ShortStringSchema,
  enabled: z.boolean().default(false),
  status: ChannelStatusSchema.default('disconnected'),
  config: z.record(z.unknown()).default({}),
  lastSyncAt: TimestampSchema.optional(),
  lastError: z.string().optional(),
  metadata: MetadataSchema,
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});

export type Channel = z.infer<typeof ChannelSchema>;

export const CreateChannelInputSchema = ChannelSchema.omit({
  id: true,
  userId: true,
  status: true,
  lastSyncAt: true,
  lastError: true,
  createdAt: true,
  updatedAt: true,
});

export type CreateChannelInput = z.infer<typeof CreateChannelInputSchema>;

export const UpdateChannelInputSchema = CreateChannelInputSchema.partial();

export type UpdateChannelInput = z.infer<typeof UpdateChannelInputSchema>;

/**
 * Channel pairing (for Telegram / 6-digit code)
 */
export const ChannelPairingSchema = z.object({
  id: UuidSchema,
  channelType: ChannelTypeSchema,
  code: z.string().length(6),
  userId: UuidSchema.optional(),
  expiresAt: TimestampSchema,
  createdAt: TimestampSchema,
});

export type ChannelPairing = z.infer<typeof ChannelPairingSchema>;
