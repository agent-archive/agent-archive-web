export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedOwner } from '@/lib/server/owner-auth';
import { hasDatabase } from '@/lib/server/db';
import { query } from '@/lib/server/db';
import { createAuthorizationCode, getClient, validateRedirectUri } from '@/lib/server/oauth-service';
import { enforceRateLimit } from '@/lib/server/request-guards';

/**
 * POST /oauth/authorize/callback
 * Called by the consent page after the user clicks Allow.
 * Generates an authorization code and returns the redirect URL.
 */
export async function POST(request: NextRequest) {
  try {
    if (!hasDatabase()) {
      return NextResponse.json({ error: 'Not available' }, { status: 503 });
    }

    const rateLimited = await enforceRateLimit(request, 'oauth:authorize', { limit: 20, windowMs: 60 * 60 * 1000 });
    if (rateLimited) return rateLimited;

    const owner = await getAuthenticatedOwner(request);
    if (!owner) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { client_id, redirect_uri, code_challenge, scope, state, agent_id, action } = body;

    if (action === 'deny') {
      const url = new URL(redirect_uri);
      url.searchParams.set('error', 'access_denied');
      url.searchParams.set('state', state);
      return NextResponse.json({ redirect: url.toString() });
    }

    // Validate client
    const client = await getClient(client_id);
    if (!client) {
      return NextResponse.json({ error: 'Invalid client_id' }, { status: 400 });
    }

    // Validate redirect URI
    if (!validateRedirectUri(redirect_uri, client.redirect_uris)) {
      return NextResponse.json({ error: 'Invalid redirect_uri' }, { status: 400 });
    }

    // Validate agent belongs to this owner
    const agentCheck = await query<{ owner_id: string | null }>(
      `SELECT owner_id FROM agents WHERE id = $1 AND status = 'active'`,
      [agent_id]
    );
    if (!agentCheck.rows[0] || agentCheck.rows[0].owner_id !== owner.id) {
      return NextResponse.json({ error: 'Invalid agent' }, { status: 400 });
    }

    // Generate authorization code
    const code = await createAuthorizationCode({
      clientId: client_id,
      ownerId: owner.id,
      agentId: agent_id,
      redirectUri: redirect_uri,
      scope: scope || 'read write',
      codeChallenge: code_challenge,
    });

    const url = new URL(redirect_uri);
    url.searchParams.set('code', code);
    url.searchParams.set('state', state);

    return NextResponse.json({ redirect: url.toString() });
  } catch (error) {
    console.error('OAuth authorize callback failed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
