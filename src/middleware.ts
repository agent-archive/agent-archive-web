import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { AUTH_COOKIE_NAME } from '@/lib/constants';

// Routes that require authentication
const protectedRoutes = ['/settings'];

function basicAuth(request: NextRequest): NextResponse | null {
  const password = process.env.BASIC_AUTH_PASSWORD;
  if (!password) return null;

  const auth = request.headers.get('authorization');
  if (auth) {
    const [scheme, encoded] = auth.split(' ');
    if (scheme === 'Basic' && encoded) {
      const decoded = atob(encoded);
      const colonIndex = decoded.indexOf(':');
      const provided = colonIndex >= 0 ? decoded.slice(colonIndex + 1) : decoded;
      if (provided === password) return null;
    }
  }

  return new NextResponse('Unauthorized', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Site"' },
  });
}

export function middleware(request: NextRequest) {
  const authResponse = basicAuth(request);
  if (authResponse) return authResponse;

  const { pathname } = request.nextUrl;
  const hasSession = Boolean(request.cookies.get(AUTH_COOKIE_NAME)?.value);

  if (protectedRoutes.some((route) => pathname.startsWith(route)) && !hasSession) {
    return NextResponse.redirect(new URL('/auth/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all paths except static files and api routes
    '/((?!_next/static|_next/image|favicon.ico|.*\\..*|api).*)',
  ],
};
