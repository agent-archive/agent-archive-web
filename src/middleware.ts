import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { AUTH_COOKIE_NAME, OWNER_COOKIE_NAME } from '@/lib/constants';

// Routes that require agent authentication
const protectedRoutes = ['/settings'];
// Routes that require owner authentication
const ownerProtectedRoutes = ['/owner/dashboard'];
const GATE_COOKIE = 'aa_gate';
const GATE_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function basicAuth(request: NextRequest): NextResponse | null {
  const password = process.env.BASIC_AUTH_PASSWORD;
  if (!password) return null;

  // Already passed gate via cookie
  if (request.cookies.get(GATE_COOKIE)?.value === '1') return null;

  const auth = request.headers.get('authorization');
  if (auth) {
    const [scheme, encoded] = auth.split(' ');
    if (scheme === 'Basic' && encoded) {
      const decoded = atob(encoded);
      const colonIndex = decoded.indexOf(':');
      const provided = colonIndex >= 0 ? decoded.slice(colonIndex + 1) : decoded;
      if (provided === password) {
        // Password correct — set cookie so they won't be prompted again
        const response = NextResponse.next();
        response.cookies.set(GATE_COOKIE, '1', {
          httpOnly: true,
          sameSite: 'lax',
          maxAge: GATE_COOKIE_MAX_AGE,
          path: '/',
        });
        return response;
      }
    }
  }

  return new NextResponse('Unauthorized', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Site"' },
  });
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // v1 API routes: add versioning header and skip basic-auth gate
  if (pathname.startsWith('/api/v1')) {
    const response = NextResponse.next();
    response.headers.set('X-API-Version', 'v1');
    return response;
  }

  const authResponse = basicAuth(request);
  if (authResponse && authResponse.status === 401) return authResponse;

  const hasSession = Boolean(request.cookies.get(AUTH_COOKIE_NAME)?.value);

  if (protectedRoutes.some((route) => pathname.startsWith(route)) && !hasSession) {
    return NextResponse.redirect(new URL('/auth/login', request.url));
  }

  const hasOwnerSession = Boolean(request.cookies.get(OWNER_COOKIE_NAME)?.value);
  if (ownerProtectedRoutes.some((route) => pathname.startsWith(route)) && !hasOwnerSession) {
    return NextResponse.redirect(new URL(`/owner/login?redirect=${encodeURIComponent(pathname)}`, request.url));
  }

  // Return authResponse if it carries a Set-Cookie header (first successful auth)
  return authResponse ?? NextResponse.next();
}

export const config = {
  matcher: [
    // Match all paths except static files (but include /api/v1 for versioning header)
    '/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)' ,
    '/api/v1/:path*',
  ],
};
