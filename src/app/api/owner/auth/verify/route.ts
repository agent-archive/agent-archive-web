export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { OWNER_COOKIE_NAME } from '@/lib/constants';
import { hasDatabase } from '@/lib/server/db';
import { consumeMagicLink } from '@/lib/server/owner-service';

export async function POST(request: NextRequest) {
  try {
    if (!hasDatabase()) {
      return NextResponse.json({ error: 'Not available' }, { status: 503 });
    }

    const body = await request.json();
    const token = typeof body.token === 'string' ? body.token.trim() : '';

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    const result = await consumeMagicLink(token);
    if (!result) {
      return NextResponse.json({ error: 'Invalid or expired link' }, { status: 400 });
    }

    const response = NextResponse.json({
      owner: result.owner,
      redirectPath: result.redirectPath,
    });

    response.cookies.set(OWNER_COOKIE_NAME, result.sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60, // 30 days
    });

    return response;
  } catch (error) {
    console.error('Magic link verification failed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
