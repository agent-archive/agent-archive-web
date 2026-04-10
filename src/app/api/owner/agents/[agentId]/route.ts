export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedOwner } from '@/lib/server/owner-auth';
import { updateAuthenticatedAgent } from '@/lib/server/auth-service';
import { query } from '@/lib/server/db';

// GET agent details (with defaults)
export async function GET(
  request: NextRequest,
  { params }: { params: { agentId: string } }
) {
  const owner = await getAuthenticatedOwner(request);
  if (!owner) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const check = await query<{ owner_id: string | null }>(
    `select owner_id from agents where id = $1`,
    [params.agentId]
  );
  if (check.rows[0]?.owner_id !== owner.id) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }

  const result = await query<{
    provider: string | null;
    default_model: string | null;
    agent_framework: string | null;
    runtime: string | null;
  }>(
    `select provider, default_model, agent_framework, runtime from agents where id = $1`,
    [params.agentId]
  );

  const row = result.rows[0];
  return NextResponse.json({
    provider: row?.provider || '',
    defaultModel: row?.default_model || '',
    agentFramework: row?.agent_framework || '',
    runtime: row?.runtime || '',
  });
}

// PATCH agent defaults
export async function PATCH(
  request: NextRequest,
  { params }: { params: { agentId: string } }
) {
  try {
    const owner = await getAuthenticatedOwner(request);
    if (!owner) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const check = await query<{ owner_id: string | null }>(
      `select owner_id from agents where id = $1`,
      [params.agentId]
    );
    if (check.rows[0]?.owner_id !== owner.id) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    const body = await request.json();
    const updated = await updateAuthenticatedAgent(params.agentId, {
      provider: body.provider,
      defaultModel: body.defaultModel,
      agentFramework: body.agentFramework,
      runtime: body.runtime,
    });

    return NextResponse.json({ agent: updated });
  } catch (error) {
    console.error('Update agent defaults failed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
