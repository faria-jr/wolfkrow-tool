/**
 * Auth schemas — user, TOTP, sessions
 */

import { z } from 'zod';

import {
  EmailSchema,
  MetadataSchema,
  TimestampSchema,
  UuidSchema,
} from './common';

export const UserRoleSchema = z.enum(['owner']);

export type UserRole = z.infer<typeof UserRoleSchema>;

/**
 * User (single-user app, but schema is flexible)
 */
export const UserSchema = z.object({
  id: UuidSchema,
  email: EmailSchema.optional(),
  displayName: z.string().max(100).optional(),
  role: UserRoleSchema.default('owner'),
  totpEnabled: z.boolean().default(false),
  totpSecret: z.string().optional(),
  failedAttempts: z.number().int().min(0).default(0),
  lockedUntil: TimestampSchema.optional(),
  lastLogin: TimestampSchema.optional(),
  metadata: MetadataSchema,
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});

export type User = z.infer<typeof UserSchema>;

/**
 * Setup password input (first run)
 */
export const SetupPasswordInputSchema = z
  .object({
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(128, 'Password too long')
      .regex(/[A-Za-z]/, 'Must contain at least one letter')
      .regex(/\d/, 'Must contain at least one number'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export type SetupPasswordInput = z.infer<typeof SetupPasswordInputSchema>;

/**
 * Login input
 */
export const LoginInputSchema = z.object({
  password: z.string().min(1).max(128),
});

export type LoginInput = z.infer<typeof LoginInputSchema>;

/**
 * TOTP input
 */
export const TotpInputSchema = z.object({
  code: z.string().regex(/^\d{6}$/, 'TOTP code must be 6 digits'),
});

export type TotpInput = z.infer<typeof TotpInputSchema>;

/**
 * Enable TOTP input
 */
export const EnableTotpInputSchema = z.object({
  password: z.string().min(1).max(128),
  code: z.string().regex(/^\d{6}$/),
});

export type EnableTotpInput = z.infer<typeof EnableTotpInputSchema>;

/**
 * Auth Audit Log
 */
export const AuthAuditActionSchema = z.enum([
  'login.success',
  'login.fail',
  'totp.success',
  'totp.fail',
  'logout',
  'lock',
  'unlock',
  'totp.enable',
  'totp.disable',
  'password.change',
]);

export type AuthAuditAction = z.infer<typeof AuthAuditActionSchema>;

export const AuthAuditLogSchema = z.object({
  id: UuidSchema,
  userId: UuidSchema.optional(),
  action: AuthAuditActionSchema,
  ip: z.string().optional(),
  userAgent: z.string().optional(),
  metadata: MetadataSchema,
  timestamp: TimestampSchema,
});

export type AuthAuditLog = z.infer<typeof AuthAuditLogSchema>;

/**
 * Login response
 */
export const LoginResponseSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('success'),
    userId: UuidSchema,
  }),
  z.object({
    status: z.literal('requires_totp'),
    userId: UuidSchema,
  }),
  z.object({
    status: z.literal('locked'),
    lockedUntil: TimestampSchema,
  }),
]);

export type LoginResponse = z.infer<typeof LoginResponseSchema>;
