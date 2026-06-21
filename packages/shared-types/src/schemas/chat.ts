/**
 * Chat schemas — sessions, messages, attachments, streaming events
 */

import { z } from 'zod';

import {
  LongStringSchema,
  MetadataSchema,
  NonEmptyStringSchema,
  ShortStringSchema,
  TimestampSchema,
  UuidSchema,
} from './common';

export const ChatRoleSchema = z.enum(['user', 'assistant', 'system', 'tool']);

export type ChatRole = z.infer<typeof ChatRoleSchema>;

/**
 * Tool call (Anthropic format)
 */
export const ToolCallSchema = z.object({
  id: NonEmptyStringSchema,
  name: NonEmptyStringSchema,
  input: z.record(z.unknown()),
});

export type ToolCall = z.infer<typeof ToolCallSchema>;

export const ToolResultSchema = z.object({
  toolCallId: NonEmptyStringSchema,
  output: z.unknown(),
  isError: z.boolean().default(false),
});

export type ToolResult = z.infer<typeof ToolResultSchema>;

export const MessageMetadataSchema = z
  .object({
    model: z.string().optional(),
    tokens: z
      .object({
        input: z.number().int().min(0).optional(),
        output: z.number().int().min(0).optional(),
        cacheRead: z.number().int().min(0).optional(),
        cacheWrite: z.number().int().min(0).optional(),
      })
      .optional(),
    cost: z.number().min(0).optional(),
    durationMs: z.number().int().min(0).optional(),
    toolCallCount: z.number().int().min(0).optional(),
  })
  .and(MetadataSchema);

export type MessageMetadata = z.infer<typeof MessageMetadataSchema>;

/**
 * Chat Message
 */
export const ChatMessageSchema = z.object({
  id: UuidSchema,
  sessionId: UuidSchema,
  userId: UuidSchema,
  role: ChatRoleSchema,
  content: LongStringSchema,
  attachments: z.array(UuidSchema).default([]),
  toolCalls: z.array(ToolCallSchema).default([]),
  toolResults: z.array(ToolResultSchema).default([]),
  metadata: MessageMetadataSchema.default({}),
  createdAt: TimestampSchema,
});

export type ChatMessage = z.infer<typeof ChatMessageSchema>;

/**
 * Send message input
 */
export const SendMessageInputSchema = z.object({
  sessionId: UuidSchema.optional(),
  agentId: UuidSchema,
  content: LongStringSchema,
  attachments: z.array(UuidSchema).default([]),
  metadata: MetadataSchema.default({}),
});

export type SendMessageInput = z.infer<typeof SendMessageInputSchema>;

/**
 * Chat Session
 */
export const ChatSessionSchema = z.object({
  id: UuidSchema,
  userId: UuidSchema,
  agentId: UuidSchema,
  title: ShortStringSchema.optional(),
  archived: z.boolean().default(false),
  metadata: MetadataSchema,
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
  lastActivity: TimestampSchema,
});

export type ChatSession = z.infer<typeof ChatSessionSchema>;

/**
 * Create session input
 */
export const CreateChatSessionInputSchema = z.object({
  agentId: UuidSchema,
  title: ShortStringSchema.optional(),
  metadata: MetadataSchema.default({}),
});

export type CreateChatSessionInput = z.infer<typeof CreateChatSessionInputSchema>;

/**
 * Update session input
 */
export const UpdateChatSessionInputSchema = z.object({
  title: ShortStringSchema.optional(),
  archived: z.boolean().optional(),
  metadata: MetadataSchema.optional(),
});

export type UpdateChatSessionInput = z.infer<typeof UpdateChatSessionInputSchema>;

/**
 * Chat Attachment (file metadata, file stored separately)
 */
export const ChatAttachmentSchema = z.object({
  id: UuidSchema,
  messageId: UuidSchema,
  filename: ShortStringSchema,
  mimeType: NonEmptyStringSchema,
  size: z.number().int().positive(),
  path: NonEmptyStringSchema,
  createdAt: TimestampSchema,
});

export type ChatAttachment = z.infer<typeof ChatAttachmentSchema>;
