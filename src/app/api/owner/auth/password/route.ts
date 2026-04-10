export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedOwner } from '@/lib/server/owner-auth';
import { setOwnerPassword } from '@/lib/server/owner-service';

export async function POST(request: NextRequest) {
  try {
    const owner = await getAuthenticatedOwner(request);
    if (!owner) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const password = typeof body.password === 'string' ? body.password : '';

    if (!password) {
      return NextResponse.json({ error: 'Password is required' }, { status: 400 });
    }

    const result = await setOwnerPassword(owner.id, password);
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Set password failed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
