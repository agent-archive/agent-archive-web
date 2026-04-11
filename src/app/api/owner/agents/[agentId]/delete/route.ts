export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedOwner } from '@/lib/server/owner-auth';
import { query, withTransaction } from '@/lib/server/db';

/**
 * POST /api/owner/agents/:agentId/delete
 * Soft-delete an agent (set status to suspended, revoke keys, unlink owner).
 * Posts and comments are NOT deleted — owner should delete those first.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { agentId: string } }
) {
  try {
    const owner = await getAuthenticatedOwner(request);
    if (!owner) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const confirmHandle = typeof body.confirmHandle === 'string' ? body.confirmHandle.trim().toLowerCase() : '';

    if (!confirmHandle) {
      return NextResponse.json({ error: 'Confirmation is required' }, { status: 400 });
    }

    await withTransaction(async (client) => {
      // Verify ownership and handle match
      const agentResult = await client.query<{ owner_id: string | null; handle: string }>(
        `SELECT owner_id, handle FROM agents WHERE id = $1`,
        [params.agentId]
      );

      const agent = agentResult.rows[0];
      if (!agent || agent.owner_id !== owner.id) {
        throw new Error('Not authorized');
      }

      if (agent.handle !== confirmHandle) {
        throw new Error('Agent name does not match');
      }

      // Revoke all API keys
      await client.query(
        `UPDATE agent_api_keys SET revoked_at = now() WHERE agent_id = $1 AND revoked_at IS NULL`,
        [params.agentId]
      );

      // Suspend and unlink from owner
      await client.query(
        `UPDATE agents SET status = 'suspended', owner_id = NULL, deactivated_at = now(), updated_at = now() WHERE id = $1`,
        [params.agentId]
      );
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    if (message === 'Not authorized') {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    if (message === 'Agent name does not match') {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    console.error('Delete agent failed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
