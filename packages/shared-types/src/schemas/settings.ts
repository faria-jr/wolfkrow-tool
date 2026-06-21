/**
 * Settings schemas — app configuration
 */

import { z } from 'zod';

import {
  MetadataSchema,
  NonEmptyStringSchema,
  ShortStringSchema,
  TimestampSchema,
  UuidSchema,
} from './common';
import { ThemeSchema } from './common';

export const VoiceProviderSchema = z.enum(['elevenlabs', 'cartesia']);

export type VoiceProvider = z.infer<typeof VoiceProviderSchema>;

export const STTProviderSchema = z.enum(['whisper-local', 'openai-whisper']);

export type STTProvider = z.infer<typeof STTProviderSchema>;

export const CompactionModelSchema = z.enum(['claude-haiku-3-5', 'claude-haiku-4', 'gemini-flash']);

export type CompactionModel = z.infer<typeof CompactionModelSchema>;

export const VoiceSettingsSchema = z.object({
  provider: VoiceProviderSchema,
  voiceId: ShortStringSchema,
  speed: z.number().min(0.5).max(2).default(1),
  stability: z.number().min(0).max(1).default(0.5),
  similarityBoost: z.number().min(0).max(1).default(0.5),
});

export type VoiceSettings = z.infer<typeof VoiceSettingsSchema>;

export const STTSettingsSchema = z.object({
  provider: STTProviderSchema,
  model: ShortStringSchema.default('whisper-1'),
  language: z.string().default('auto'),
});

export type STTSettings = z.infer<typeof STTSettingsSchema>;

export const OrchestratorConfigSchema = z.object({
  sdk: z.enum(['claude-agent', 'claude-compat', 'codex', 'lion']),
  model: NonEmptyStringSchema,
  effort: z.enum(['low', 'medium', 'high', 'max']).default('medium'),
  thinking: z.boolean().default(false),
});

export type OrchestratorConfig = z.infer<typeof OrchestratorConfigSchema>;

export const CompactionSettingsSchema = z.object({
  enabled: z.boolean().default(true),
  trigger: z.enum(['token_threshold', 'time_based', 'manual']).default('token_threshold'),
  tokenThreshold: z.number().int().positive().default(150_000),
  model: CompactionModelSchema.default('claude-haiku-4'),
  preserveLastMessages: z.number().int().min(0).default(10),
});

export type CompactionSettings = z.infer<typeof CompactionSettingsSchema>;

/**
 * App Settings (single user, but schema flexible)
 */
export const SettingsSchema = z.object({
  id: UuidSchema,
  userId: UuidSchema,
  theme: ThemeSchema.default('system'),
  orchestrator: OrchestratorConfigSchema,
  voice: VoiceSettingsSchema.optional(),
  stt: STTSettingsSchema.optional(),
  compaction: CompactionSettingsSchema,
  telemetry: z.boolean().default(false),
  autoLaunch: z.boolean().default(false),
  autoLockMinutes: z.number().int().positive().default(5),
  metadata: MetadataSchema,
  updatedAt: TimestampSchema,
});

export type Settings = z.infer<typeof SettingsSchema>;

export const UpdateSettingsInputSchema = SettingsSchema.omit({
  id: true,
  userId: true,
  updatedAt: true,
}).partial();

export type UpdateSettingsInput = z.infer<typeof UpdateSettingsInputSchema>;
