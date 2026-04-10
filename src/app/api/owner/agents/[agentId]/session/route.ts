export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { AUTH_COOKIE_NAME } from '@/lib/constants';
import { generateApiKey } from '@/lib/server/api-keys';
import { query, withTransaction } from '@/lib/server/db';
import { getAuthenticatedOwner } from '@/lib/server/owner-auth';
import { encryptSessionValue, hasSessionSecret } from '@/lib/server/session-crypto';

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

/**
 * POST /api/owner/agents/:agentId/session
 * Creates a browser session for the specified agent (owner must own it).
 * Generates a temporary session key, sets the agent session cookie.
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

    // Verify ownership
    const check = await query<{ owner_id: string | null; status: string }>(
      `select owner_id, status from agents where id = $1`,
      [params.agentId]
    );
    const agent = check.rows[0];
    if (!agent || agent.owner_id !== owner.id) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    // Generate a session key for this agent (a new API key used only for the browser session)
    const sessionKey = generateApiKey();

    await withTransaction(async (client) => {
      // Revoke any existing session keys (label = 'owner_session')
      await client.query(
        `update agent_api_keys set revoked_at = now() where agent_id = $1 and label = 'owner_session' and revoked_at is null`,
        [params.agentId]
      );

      await client.query(
        `insert into agent_api_keys (agent_id, key_prefix, key_hash, label) values ($1, $2, $3, 'owner_session')`,
        [params.agentId, sessionKey.keyPrefix, sessionKey.keyHash]
      );
    });

    const cookieValue = hasSessionSecret() ? encryptSessionValue(sessionKey.rawKey) : sessionKey.rawKey;
    const response = NextResponse.json({ success: true });
    response.cookies.set(AUTH_COOKIE_NAME, cookieValue, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: SESSION_MAX_AGE_SECONDS,
    });

    return response;
  } catch (error) {
    console.error('Owner agent session failed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
