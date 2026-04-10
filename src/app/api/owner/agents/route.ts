export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedOwner } from '@/lib/server/owner-auth';
import { getOwnerAgents } from '@/lib/server/owner-service';

export async function GET(request: NextRequest) {
  const owner = await getAuthenticatedOwner(request);
  if (!owner) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const agents = await getOwnerAgents(owner.id);
  return NextResponse.json({ agents });
}
