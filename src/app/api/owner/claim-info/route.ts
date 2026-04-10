export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { hasDatabase } from '@/lib/server/db';
import { getClaimInfo } from '@/lib/server/owner-service';

export async function GET(request: NextRequest) {
  if (!hasDatabase()) {
    return NextResponse.json({ error: 'Not available' }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token')?.trim();

  if (!token) {
    return NextResponse.json({ error: 'Token is required' }, { status: 400 });
  }

  const info = await getClaimInfo(token);
  if (!info) {
    return NextResponse.json({ error: 'Invalid claim token' }, { status: 404 });
  }

  return NextResponse.json(info);
}
