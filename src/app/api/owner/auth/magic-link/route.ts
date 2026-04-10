export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { hasDatabase } from '@/lib/server/db';
import { requestMagicLink } from '@/lib/server/owner-service';

export async function POST(request: NextRequest) {
  try {
    if (!hasDatabase()) {
      return NextResponse.json({ error: 'Not available' }, { status: 503 });
    }

    const body = await request.json();
    const email = typeof body.email === 'string' ? body.email.toLowerCase().trim() : '';

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'A valid email address is required' }, { status: 400 });
    }

    await requestMagicLink(email, body.redirectPath);

    // Always return success to prevent email enumeration
    return NextResponse.json({ sent: true });
  } catch (error) {
    console.error('Magic link request failed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
