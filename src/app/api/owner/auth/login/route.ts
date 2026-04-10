export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { OWNER_COOKIE_NAME } from '@/lib/constants';
import { hasDatabase } from '@/lib/server/db';
import { loginWithPassword } from '@/lib/server/owner-service';

export async function POST(request: NextRequest) {
  try {
    if (!hasDatabase()) {
      return NextResponse.json({ error: 'Not available' }, { status: 503 });
    }

    const body = await request.json();
    const email = typeof body.email === 'string' ? body.email.toLowerCase().trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    const result = await loginWithPassword(email, password);
    if (!result) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    const response = NextResponse.json({ owner: result.owner });

    response.cookies.set(OWNER_COOKIE_NAME, result.sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60,
    });

    return response;
  } catch (error) {
    console.error('Password login failed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
