export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedOwner } from '@/lib/server/owner-auth';
import { rotateAgentApiKey } from '@/lib/server/owner-service';

export async function POST(
  request: NextRequest,
  { params }: { params: { agentId: string } }
) {
  try {
    const owner = await getAuthenticatedOwner(request);
    if (!owner) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await rotateAgentApiKey(owner.id, params.agentId);

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: 403 });
    }

    return NextResponse.json({
      apiKey: result.apiKey,
      keyPrefix: result.keyPrefix,
      important: 'Save this API key now. It is only shown once.',
    });
  } catch (error) {
    console.error('Rotate key failed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
