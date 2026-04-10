export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedOwner } from '@/lib/server/owner-auth';
import { claimAgent } from '@/lib/server/owner-service';

export async function POST(request: NextRequest) {
  try {
    const owner = await getAuthenticatedOwner(request);
    if (!owner) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const claimToken = typeof body.claimToken === 'string' ? body.claimToken.trim() : '';

    if (!claimToken) {
      return NextResponse.json({ error: 'Claim token is required' }, { status: 400 });
    }

    const result = await claimAgent(claimToken, owner.id);

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, agentId: result.agentId });
  } catch (error) {
    console.error('Claim agent failed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
