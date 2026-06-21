/**
 * Voice schemas — STT, TTS, voice sessions
 */

import { z } from 'zod';

import { MetadataSchema, ShortStringSchema, TimestampSchema, UuidSchema } from './common';
import { STTProviderSchema, VoiceProviderSchema } from './settings';

export const VoiceSessionStatusSchema = z.enum([
  'idle',
  'listening',
  'processing',
  'speaking',
  'thinking',
  'error',
  'ended',
]);

export type VoiceSessionStatus = z.infer<typeof VoiceSessionStatusSchema>;

/**
 * Voice Session
 */
export const VoiceSessionSchema = z.object({
  id: UuidSchema,
  userId: UuidSchema,
  chatSessionId: UuidSchema.optional(),
  status: VoiceSessionStatusSchema.default('idle'),
  sttProvider: STTProviderSchema.optional(),
  ttsProvider: VoiceProviderSchema.optional(),
  ttsVoiceId: ShortStringSchema.optional(),
  startedAt: TimestampSchema.optional(),
  endedAt: TimestampSchema.optional(),
  totalDurationMs: z.number().int().min(0).default(0),
  turnCount: z.number().int().min(0).default(0),
  bargeInCount: z.number().int().min(0).default(0),
  metadata: MetadataSchema,
});

export type VoiceSession = z.infer<typeof VoiceSessionSchema>;

/**
 * STT request input
 */
export const STTRequestSchema = z.object({
  audio: z.instanceof(Buffer).or(z.instanceof(Uint8Array)),
  language: z.string().default('auto'),
});

export type STTRequest = z.infer<typeof STTRequestSchema>;

export const STTResponseSchema = z.object({
  text: z.string(),
  language: z.string().optional(),
  durationMs: z.number().int().min(0).optional(),
});

export type STTResponse = z.infer<typeof STTResponseSchema>;

/**
 * TTS request input
 */
export const TTSRequestSchema = z.object({
  text: z.string().min(1).max(10_000),
  voiceId: ShortStringSchema,
  speed: z.number().min(0.5).max(2).default(1),
});

export type TTSRequest = z.infer<typeof TTSRequestSchema>;
