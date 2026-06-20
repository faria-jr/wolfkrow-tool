# ADR-0017: JWT em Cookies HttpOnly para Auth

**Status**: ✅ Aceito
**Data**: 2026-06-20

## Contexto

O Wolfkrow Tool precisa de autenticação robusta:

- Single-user (mas com TOTP 2FA opcional)
- Browser-based (Next.js)
- Server-side (Worker)
- WebSocket (PTY)
- SSE (streaming)

Opções:
1. **JWT em localStorage**: vulnerável a XSS
2. **Session cookies (server-side)**: precisa de Redis/DB lookup
3. **JWT em HttpOnly cookies**: seguro contra XSS, stateless
4. **OAuth2**: requer provider externo
5. **HTTP Basic Auth**: fraco

## Decisão

**JWT (HS256)** assinado com secret compartilhado entre Next.js e Worker, armazenado em **HttpOnly + Secure + SameSite=Strict** cookies.

```typescript
// packages/infra/src/auth/jwt.ts
import { SignJWT, jwtVerify } from 'jose';

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET || crypto.randomBytes(32));

export async function signJWT(payload: { sub: string }): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(SECRET);
}

export async function verifyJWT(token: string): Promise<{ sub: string } | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return { sub: payload.sub as string };
  } catch {
    return null;
  }
}
```

```typescript
// apps/web/lib/auth/session.ts
import { cookies } from 'next/headers';

const COOKIE_NAME = 'wolfkrow_session';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export async function createSession(userId: string) {
  const token = await signJWT({ sub: userId });
  
  cookies().set(COOKIE_NAME, token, {
    httpOnly: true,                 // ❌ JS can't access (XSS-proof)
    secure: process.env.NODE_ENV === 'production',  // HTTPS only
    sameSite: 'strict',             // ❌ CSRF-proof
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  });
}

export async function getSession(): Promise<{ userId: string } | null> {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyJWT(token);
}

export async function requireSession(): Promise<{ userId: string }> {
  const session = await getSession();
  if (!session) throw new UnauthorizedError();
  return session;
}

export async function destroySession() {
  cookies().delete(COOKIE_NAME);
}
```

## Consequências

### Positivas

- **HttpOnly**: JS não acessa (XSS-proof)
- **Secure**: HTTPS only em produção
- **SameSite=Strict**: CSRF-proof
- **Stateless**: não precisa server-side session store
- **Cross-process**: Next.js e Worker compartilham mesmo secret
- **WS-friendly**: WebSocket pode validar via query string (futuro)

### Negativas

- **JWT revocation**: stateless = sem revoke imediato (mitigado por expiração curta)
- **Secret rotation**: requer migração cuidadosa
- **Cookie size**: 4KB limit (não problema para nosso caso)

### Mitigações

- Short expiry (7 dias) + refresh token (futuro)
- Logout invalida cookie no client + future JWT blacklist (opcional)

## Auth Flow

### Login

```typescript
// apps/web/app/api/auth/login/route.ts
export async function POST(req: NextRequest) {
  const { password } = LoginInputSchema.parse(await req.json());
  
  const user = await container.get(AuthenticateUser).execute({ password });
  
  if (user.requiresTotp) {
    return Response.json({ requiresTotp: true });
  }
  
  await createSession(user.id);
  return Response.json({ success: true });
}
```

### TOTP Verification

```typescript
// apps/web/app/api/auth/totp/route.ts
export async function POST(req: NextRequest) {
  const { code } = TotpInputSchema.parse(await req.json());
  
  const user = await container.get(VerifyTotp).execute({ code });
  
  if (!user) return Response.json({ error: 'Invalid code' }, { status: 401 });
  
  await createSession(user.id);
  return Response.json({ success: true });
}
```

### Middleware (Auth Gate)

```typescript
// apps/web/middleware.ts
import { NextResponse } from 'next/server';
import { verifyJWT } from '@wolfkrow/infra/auth/jwt';

export async function middleware(req: NextRequest) {
  const token = req.cookies.get('wolfkrow_session')?.value;
  
  // Public routes
  const isPublic = 
    req.nextUrl.pathname.startsWith('/login') ||
    req.nextUrl.pathname.startsWith('/onboarding') ||
    req.nextUrl.pathname.startsWith('/unlock') ||
    req.nextUrl.pathname.startsWith('/api/auth/') ||
    req.nextUrl.pathname.startsWith('/_next') ||
    req.nextUrl.pathname.startsWith('/api/health');
  
  if (isPublic) return NextResponse.next();
  
  // Verify JWT
  const session = token ? await verifyJWT(token) : null;
  
  if (!session) {
    return NextResponse.redirect(new URL('/login', req.url));
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

### Worker Auth (via Header)

```typescript
// apps/worker/src/middleware/auth.ts
import { verifyJWT } from '@wolfkrow/infra/auth/jwt';

export async function authenticateWorkerRequest(req: IncomingMessage): Promise<{ userId: string } | null> {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return null;
  
  return verifyJWT(auth.slice(7));
}
```

## Auto-Lock

```typescript
// apps/web/lib/auth/useAutoLock.ts
'use client';
import { useEffect } from 'react';

export function useAutoLock(timeoutMs = 5 * 60 * 1000) {
  useEffect(() => {
    let lastActivity = Date.now();
    
    const updateActivity = () => { lastActivity = Date.now(); };
    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    events.forEach((e) => window.addEventListener(e, updateActivity, { passive: true }));
    
    const checkIdle = () => {
      if (Date.now() - lastActivity > timeoutMs) {
        fetch('/api/auth/lock', { method: 'POST' });
      }
    };
    
    const handleVisibility = () => {
      if (document.hidden) {
        fetch('/api/auth/lock', { method: 'POST' });
      }
    };
    
    const interval = setInterval(checkIdle, 30 * 1000);
    document.addEventListener('visibilitychange', handleVisibility);
    
    return () => {
      events.forEach((e) => window.removeEventListener(e, updateActivity));
      document.removeEventListener('visibilitychange', handleVisibility);
      clearInterval(interval);
    };
  }, [timeoutMs]);
}
```

## Password Hashing

```typescript
// packages/infra/src/auth/bcrypt-adapter.ts
import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
```

## TOTP (2FA)

```typescript
// packages/infra/src/auth/totp.ts
import { authenticator } from 'otplib';

authenticator.options = { window: 1 }; // Allow ±30s

export function generateTotpSecret(): string {
  return authenticator.generateSecret();
}

export function getTotpUri(secret: string, user: string): string {
  return authenticator.keyuri(user, 'Wolfkrow Tool', secret);
}

export function verifyTotp(token: string, secret: string): boolean {
  return authenticator.verify({ token, secret });
}
```

## WebSocket Auth

WebSocket não suporta headers customizados facilmente. Opções:

### Opção A: Token via query string (menos seguro)

```typescript
const ws = new WebSocket(`ws://localhost:3000/api/pty/${id}?token=${token}`);
```

### Opção B: Subprotocol

```typescript
const ws = new WebSocket(`ws://localhost:3000/api/pty/${id}`, ['wolfkrow-jwt', token]);
```

### Opção C: Mensagem inicial

```typescript
ws.onopen = () => {
  ws.send(JSON.stringify({ type: 'auth', token }));
};

ws.onmessage = (e) => {
  const msg = JSON.parse(e.data);
  if (msg.type === 'auth-ok') {
    // Connection established
  } else if (msg.type === 'auth-fail') {
    ws.close();
  }
};
```

**Decisão**: Opção C (mensagem inicial) — mais segura.

## CSRF Protection

SameSite=Strict cookies são CSRF-proof por design. Para defense in depth:

```typescript
// apps/web/lib/auth/csrf.ts
import { cookies } from 'next/headers';
import crypto from 'crypto';

const CSRF_COOKIE = 'wolfkrow_csrf';
const CSRF_HEADER = 'x-csrf-token';

export async function getCsrfToken(): Promise<string> {
  const existing = cookies().get(CSRF_COOKIE)?.value;
  if (existing) return existing;
  
  const token = crypto.randomBytes(32).toString('hex');
  cookies().set(CSRF_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 60 * 60 * 24 * 7,
  });
  
  return token;
}

export async function requireCsrf(req: NextRequest): Promise<void> {
  const cookieToken = req.cookies.get(CSRF_COOKIE)?.value;
  const headerToken = req.headers.get(CSRF_HEADER);
  
  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    throw new ForbiddenError('Invalid CSRF token');
  }
}
```

## Rate Limiting

```typescript
// apps/web/middleware.ts
import { Ratelimit } from '@upstash/ratelimit';

const ratelimit = new Ratelimit({
  redis: ... ,
  limiter: Ratelimit.slidingWindow(10, '1 m'),
});

export async function middleware(req: NextRequest) {
  if (req.nextUrl.pathname.startsWith('/api/auth/login')) {
    const ip = req.ip ?? 'unknown';
    const { success } = await ratelimit.limit(ip);
    if (!success) {
      return new NextResponse('Too many requests', { status: 429 });
    }
  }
  // ...
}
```

## Alternativas Consideradas

### A. localStorage + JWT

**Prós**: Simples
**Contras**: XSS vulnerability
**Decisão**: ❌ Rejeitado — security fraco

### B. Server-side sessions (Redis)

**Prós**: Revogação imediata
**Contras**: Precisa Redis (mais ops)
**Decisão**: ❌ Rejeitado — overkill

### C. OAuth2 (Google, GitHub)

**Prós**: No password management
**Contras**: External dependency, complex setup
**Decisão**: ❌ Rejeitado — single-user prefere controle

### D. WebAuthn (passkeys)

**Prós**: Strongest security
**Contras**: UX complex, requires hardware
**Decisão**: 🤔 Considerado para v2.0

## References

- [JWT Spec](https://datatracker.ietf.org/doc/html/rfc7519)
- [OWASP Cookie Security](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
- [jose](https://github.com/panva/jose)
- [bcryptjs](https://github.com/dcodeIO/bcrypt.js)
- [otplib](https://github.com/yeojz/otplib)
