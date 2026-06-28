# SPEC-001: Authentication + TOTP + Auto-Lock

**Status**: 📝 Draft
**Camada**: All (Web + Worker + DB)
**Prioridade**: P0 (bloqueador)
**Owner**: Tech Lead

---

## 1. Visão Geral

Sistema de autenticação single-user com password + TOTP opcional + auto-lock em idle/visibility change.

### Objetivos

- Password forte (bcryptjs, 12 rounds)
- TOTP 2FA opcional (otplib)
- JWT em cookies HttpOnly (XSS-proof)
- Auto-lock em idle (5min) ou tab hidden
- Lock screen requer re-auth
- Failed attempts lockout (5 tentativas → 5min)

### Não-Objetivos

- Multi-user (single-user only)
- OAuth providers (v1.0 não tem)
- WebAuthn/Passkeys (v2.0)
- Account recovery (não aplicável, single-user)

---

## 2. Requisitos Funcionais

### User Stories

- **US-1**: Como usuário, quero definir uma password forte no primeiro setup
- **US-2**: Como usuário, quero opcionalmente ativar TOTP 2FA para segurança extra
- **US-3**: Como usuário, quero que o app bloqueie automaticamente após 5min de inatividade
- **US-4**: Como usuário, quero que o app bloqueie quando troco de tab (Page Visibility API)
- **US-5**: Como usuário, quero ver tela de lock com password re-prompt (não logout)
- **US-6**: Como usuário, quero 5 tentativas erradas → lockout de 5min
- **US-7**: Como usuário, quero poder desativar TOTP se ativei por engano

### Critérios de Aceitação

- [ ] Setup inicial força criação de password (≥8 chars, ≥1 número, ≥1 letra)
- [ ] Password hash armazenado com bcrypt (12 rounds)
- [ ] TOTP pode ser ativado/desativado em Settings
- [ ] QR code gerado para TOTP setup (compatível com Google Authenticator, 1Password, Authy)
- [ ] Lock screen aparece após 5min de idle OU tab hidden
- [ ] Lock screen requer password (com TOTP se ativado)
- [ ] 5 tentativas erradas → lockout de 5min
- [ ] Sessão JWT expira em 30 dias
- [ ] Refresh token fora do MVP; reautenticar após expiração fixa

---

## 3. Requisitos Não-Funcionais

### Performance

- Login <500ms (P95)
- TOTP verification <100ms
- Lock check <50ms (debounced 30s)

### Segurança

- Password nunca armazenado em plaintext
- JWT assinado com ES256 + chave P-256 local, validado pelo Worker via JWKS
- Cookies HttpOnly + SameSite=Lax
- CSRF protection via SameSite + token
- Rate limit: 10 attempts/min per IP
- Audit log de todas tentativas (success/fail)

### Usabilidade

- Lock screen claro ("Sua sessão foi bloqueada")
- Password input com show/hide toggle
- TOTP input aceita código de 6 dígitos (com auto-submit)
- Mensagens de erro específicas (não "credenciais inválidas" genérico)

---

## 4. Arquitetura

```
┌──────────────────────────────────────────────────────────┐
│              Browser (Next.js)                            │
│                                                           │
│  /login page        /unlock page        /onboarding       │
│  ┌──────────┐       ┌──────────┐        ┌──────────┐    │
│  │ Form     │       │ Form     │        │ Wizard   │    │
│  └─────┬────┘       └─────┬────┘        └─────┬────┘    │
│        │                  │                   │         │
│        └──────────────────┼───────────────────┘         │
│                           │                              │
│  useAutoLock() ───────────┤                              │
│                           ▼                              │
│                  POST /api/auth/*                        │
│                  (with CSRF token)                       │
└───────────────────────────┬──────────────────────────────┘
                            │ JWT validation
                            ▼
┌──────────────────────────────────────────────────────────┐
│              Next.js Route Handlers                       │
│                                                           │
│  /api/auth/login      /api/auth/totp     /api/auth/logout│
│  /api/auth/lock       /api/auth/unlock   /api/auth/setup │
│                                                           │
│  Middleware: auth gate (verify JWT)                      │
└───────────────────────────┬──────────────────────────────┘
                            │ Use cases
                            ▼
┌──────────────────────────────────────────────────────────┐
│         packages/use-cases/auth/                          │
│                                                           │
│  SetupPassword  AuthenticateUser  VerifyTotp             │
│  LockSession    UnlockSession     EnableTotp             │
│  DisableTotp    ResetPassword (single-user)              │
└───────────────────────────┬──────────────────────────────┘
                            │ Repos
                            ▼
┌──────────────────────────────────────────────────────────┐
│              packages/infra/repos/                        │
│                                                           │
│  DrizzleUserRepo  DrizzleAuditRepo  KeytarSecretsAdapter │
└──────────────────────────────────────────────────────────┘
```

---

## 5. Database Schema

```typescript
// packages/infra/src/db/schema/auth.ts
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  passwordHash: text('password_hash').notNull(), // bcrypt
  totpSecret: text('totp_secret'), // null = TOTP disabled
  totpEnabled: integer('totp_enabled', { mode: 'boolean' }).default(false),
  failedAttempts: integer('failed_attempts').default(0),
  lockedUntil: integer('locked_until', { mode: 'timestamp' }),
  lastLogin: integer('last_login', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export const authAuditLog = sqliteTable('auth_audit_log', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id),
  action: text('action', {
    enum: [
      'login.success',
      'login.fail',
      'totp.success',
      'totp.fail',
      'logout',
      'lock',
      'unlock',
      'totp.enable',
      'totp.disable',
    ],
  }).notNull(),
  ip: text('ip'),
  userAgent: text('user_agent'),
  timestamp: integer('timestamp', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});
```

---

## 6. API Contracts (Zod)

```typescript
// packages/shared-types/src/schemas/auth.ts
export const LoginInputSchema = z.object({
  password: z.string().min(1).max(100),
});

export const TotpInputSchema = z.object({
  code: z.string().regex(/^\d{6}$/),
});

export const SetupPasswordInputSchema = z
  .object({
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Za-z]/, 'Must contain at least one letter')
      .regex(/\d/, 'Must contain at least one number'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const EnableTotpInputSchema = z.object({
  code: z.string().regex(/^\d{6}$/),
});
```

---

## 7. UI/UX

### Setup Flow (First Run)

```
┌─────────────────────────────────────────┐
│  Welcome to Wolfkrow Tool               │
│                                          │
│  Create your password                    │
│  ┌──────────────────────────┐          │
│  │ Password          [👁]    │          │
│  └──────────────────────────┘          │
│  Requirements:                           │
│  ✓ At least 8 characters                 │
│  ✓ At least 1 letter                     │
│  ○ At least 1 number                     │
│                                          │
│  ┌──────────────────────────┐          │
│  │ Confirm Password  [👁]    │          │
│  └──────────────────────────┘          │
│                                          │
│  [Continue →]                            │
└─────────────────────────────────────────┘
```

### Login Flow

```
┌─────────────────────────────────────────┐
│  Wolfkrow Tool                            │
│                                          │
│  Sign in                                 │
│  ┌──────────────────────────┐          │
│  │ Password          [👁]    │          │
│  └──────────────────────────┘          │
│                                          │
│  [Sign In]                               │
│                                          │
│  Forgot password? Reset app data         │
└─────────────────────────────────────────┘
```

### TOTP Setup

```
┌─────────────────────────────────────────┐
│  Enable Two-Factor Authentication        │
│                                          │
│  1. Scan QR code with your authenticator │
│     ┌────────────┐                       │
│     │ ▄▄▄▄▄▄▄▄▄▄ │                       │
│     │ █ QR CODE █ │                       │
│     │ ▀▀▀▀▀▀▀▀▀▀ │                       │
│     └────────────┘                       │
│                                          │
│  Or enter manually:                       │
│  JBSWY3DPEHPK3PXP                       │
│                                          │
│  2. Enter 6-digit code                  │
│  ┌──┬──┬──┬──┬──┬──┐                  │
│  │  │  │  │  │  │  │                  │
│  └──┴──┴──┴──┴──┴──┘                  │
│                                          │
│  [Verify and Enable]                     │
└─────────────────────────────────────────┘
```

### Lock Screen

```
┌─────────────────────────────────────────┐
│                                          │
│              🔒                          │
│                                          │
│  Session Locked                          │
│                                          │
│  Unlock to continue                      │
│  ┌──────────────────────────┐          │
│  │ Password          [👁]    │          │
│  └──────────────────────────┘          │
│                                          │
│  [Unlock]                                │
│                                          │
│  Or sign out                             │
└─────────────────────────────────────────┘
```

---

## 8. Testes

### Unit Tests

- `SetupPassword.execute()`: validates password strength
- `AuthenticateUser.execute()`: returns user + sets session
- `VerifyTotp.execute()`: verifies TOTP code
- `LockSession.execute()`: marks session as locked
- bcrypt hashing + comparison

### Integration Tests

- Full login flow: password → TOTP → JWT cookie
- Failed attempts increment counter
- Lockout after 5 fails
- Lock screen unlock

### E2E Tests (Playwright)

- First-time setup wizard
- Login with password
- Login with password + TOTP
- Lock screen appears after idle
- Tab switch triggers lock
- Failed attempts trigger lockout

---

## 9. Riscos

| Risco                                  | Mitigação                                                  |
| -------------------------------------- | ---------------------------------------------------------- |
| Password forgotten → data inaccessible | Single-user: documented "reset = wipe data" procedure      |
| TOTP device lost                       | Backup codes (10 single-use codes generated at TOTP setup) |
| Brute force attack                     | Rate limiting + lockout + audit log                        |
| JWT secret leaked                      | Auto-rotate secret, force re-login                         |
| Session hijacking                      | HttpOnly + Secure + SameSite cookies                       |
| CSRF attack                            | SameSite=Lax + CSRF token                                  |

---

## 10. Open Questions

- [ ] Refresh token strategy: sliding window vs fixed?
- [ ] Backup codes: 10 single-use codes stored where? (hashed in DB?)
- [ ] Password reset: confirm "wipe all data" or just reset password?
- [ ] Audit log retention: forever or 90 days?
