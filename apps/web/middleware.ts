import { decodeJwt } from 'jose';
import { NextResponse, type NextRequest } from 'next/server';

const PUBLIC_ROUTES = ['/login', '/onboarding', '/unlock'];
const PUBLIC_API_ROUTES = [
  '/api/auth/login',
  '/api/auth/setup',
  '/api/auth/totp',
  '/api/health',
  '/.well-known',
];
const PUBLIC_ASSETS = ['/_next', '/icons', '/fonts', '/manifest.json', '/sw.js'];

function isPublic(pathname: string): boolean {
  return (
    PUBLIC_ROUTES.some((p) => pathname.startsWith(p)) ||
    PUBLIC_API_ROUTES.some((p) => pathname.startsWith(p)) ||
    PUBLIC_ASSETS.some((p) => pathname.startsWith(p)) ||
    pathname === '/favicon.ico'
  );
}

/** Gate rápido (decode + exp). Validação de assinatura no layout server-side. */
function isValidSession(token: string | undefined): boolean {
  if (!token) return false;
  try {
    const payload = decodeJwt(token);
    return payload.exp !== undefined && payload.exp * 1000 > Date.now();
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (isPublic(pathname)) {
    return NextResponse.next();
  }

  if (!isValidSession(request.cookies.get('session')?.value)) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
