export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { hasDatabase } from '@/lib/server/db';
import { checkOwnerHasPassword } from '@/lib/server/owner-service';

/**
 * POST /api/owner/auth/check
 * Check if an email has an existing account and whether it has a password set.
 * Used by the login page to decide whether to show password or magic link.
 */
export async function POST(request: NextRequest) {
  try {
    if (!hasDatabase()) {
      return NextResponse.json({ error: 'Not available' }, { status: 503 });
    }

    const body = await request.json();
    const email = typeof body.email === 'string' ? body.email.toLowerCase().trim() : '';

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const hasPassword = await checkOwnerHasPassword(email);

    // Always return a response to prevent email enumeration
    // If account doesn't exist, hasPassword is false → they'll get the magic link flow
    return NextResponse.json({ hasPassword });
  } catch (error) {
    console.error('Auth check failed:', error);
    return NextResponse.json({ hasPassword: false });
  }
}
