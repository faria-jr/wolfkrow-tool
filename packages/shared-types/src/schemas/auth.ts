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

/**
 * Setup request body (web onboarding wizard).
 *
 * Validates request shape only. Password *strength* is intentionally NOT
 * enforced here — that remains the responsibility of `PlainPassword.create`
 * in the handler, exactly as before this schema was introduced.
 *
 * Differs from {@link SetupPasswordInputSchema}: `confirmPassword` is optional
 * (only validated when present) and the wizard also accepts `displayName` /
 * `email`, which the use-case consumes but the password contract does not.
 */
export const SetupRequestBodySchema = z
  .object({
    password: z.string().min(1).max(128),
    confirmPassword: z.string().optional(),
    displayName: z.string().max(100).optional(),
    email: EmailSchema.optional(),
  })
  .refine(
    (data) =>
      data.confirmPassword === undefined || data.confirmPassword === data.password,
    { message: 'Passwords do not match', path: ['confirmPassword'] },
  );

export type SetupRequestBody = z.infer<typeof SetupRequestBodySchema>;

/**
 * Verify-TOTP request body (web 2nd-factor step).
 *
 * Carries `userId` (from the `requires_totp` login response) plus the 6-digit
 * `code`.
 */
export const VerifyTotpRequestBodySchema = z.object({
  userId: UuidSchema,
  code: z.string().regex(/^\d{6}$/, 'TOTP code must be 6 digits'),
});

export type VerifyTotpRequestBody = z.infer<typeof VerifyTotpRequestBodySchema>;

/**
 * Enable-TOTP request body (web). Carries the generated `secret` + `code`.
 *
 * Note: {@link EnableTotpInputSchema} uses `password` (re-auth); the web enable
 * flow instead verifies a code against a freshly generated secret.
 */
export const EnableTotpRequestBodySchema = z.object({
  secret: z.string().min(1).max(256),
  code: z.string().regex(/^\d{6}$/, 'TOTP code must be 6 digits'),
});

export type EnableTotpRequestBody = z.infer<typeof EnableTotpRequestBodySchema>;

/**
 * Disable-TOTP request body (web). Requires `password` (re-auth); `code` optional.
 */
export const DisableTotpRequestBodySchema = z.object({
  password: z.string().min(1).max(128),
  code: z.string().regex(/^\d{6}$/).optional(),
});

export type DisableTotpRequestBody = z.infer<typeof DisableTotpRequestBodySchema>;

/**
 * Unlock-session request body (web lock screen). Same shape as login.
 */
export const UnlockRequestBodySchema = z.object({
  password: z.string().min(1).max(128),
});

export type UnlockRequestBody = z.infer<typeof UnlockRequestBodySchema>;
