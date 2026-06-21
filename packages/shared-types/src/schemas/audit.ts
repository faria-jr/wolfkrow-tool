/**
 * Audit log schemas — comprehensive audit trail
 */

import { z } from 'zod';

import {
  MetadataSchema,
  NonEmptyStringSchema,
  TimestampSchema,
  UuidSchema,
} from './common';

export const AuditActionSchema = z.enum([
  'agent.create',
  'agent.update',
  'agent.delete',
  'agent.sync',
  'skill.create',
  'skill.update',
  'skill.delete',
  'mcp.start',
  'mcp.stop',
  'mcp.restart',
  'secret.create',
  'secret.update',
  'secret.delete',
  'secret.access',
  'pipeline.create',
  'pipeline.start',
  'pipeline.pause',
  'pipeline.resume',
  'pipeline.complete',
  'pipeline.cancel',
  'harness.create',
  'harness.start',
  'harness.pause',
  'harness.complete',
  'knowledge.ingest',
  'knowledge.delete',
  'memory.compact',
  'session.archive',
  'session.delete',
]);

export type AuditAction = z.infer<typeof AuditActionSchema>;

/**
 * Audit Log Entry
 */
export const AuditLogSchema = z.object({
  id: UuidSchema,
  userId: UuidSchema,
  action: AuditActionSchema,
  resourceType: NonEmptyStringSchema,
  resourceId: UuidSchema.optional(),
  metadata: MetadataSchema,
  ip: z.string().optional(),
  userAgent: z.string().optional(),
  timestamp: TimestampSchema,
});

export type AuditLog = z.infer<typeof AuditLogSchema>;
