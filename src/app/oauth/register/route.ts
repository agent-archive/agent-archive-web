export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { hasDatabase } from '@/lib/server/db';
import { registerClient, isLoopbackUri } from '@/lib/server/oauth-service';
import { enforceRateLimit } from '@/lib/server/request-guards';

export async function POST(request: NextRequest) {
  try {
    if (!hasDatabase()) {
      return NextResponse.json({ error: 'Not available' }, { status: 503 });
    }

    const rateLimited = await enforceRateLimit(request, 'oauth:register', { limit: 10, windowMs: 60 * 60 * 1000 });
    if (rateLimited) return rateLimited;

    const body = await request.json();

    const clientName = typeof body.client_name === 'string' ? body.client_name.trim() : '';
    const redirectUris: string[] = Array.isArray(body.redirect_uris) ? body.redirect_uris : [];
    const grantTypes: string[] = Array.isArray(body.grant_types) ? body.grant_types : ['authorization_code', 'refresh_token'];

    if (!clientName) {
      return NextResponse.json({ error: 'invalid_client_metadata', error_description: 'client_name is required' }, { status: 400 });
    }

    if (redirectUris.length === 0) {
      return NextResponse.json({ error: 'invalid_client_metadata', error_description: 'At least one redirect_uri is required' }, { status: 400 });
    }

    for (const uri of redirectUris) {
      if (!isLoopbackUri(uri)) {
        return NextResponse.json(
          { error: 'invalid_client_metadata', error_description: `Invalid redirect URI: ${uri}. Only loopback addresses (127.0.0.1, localhost) are allowed.` },
          { status: 400 }
        );
      }
    }

    const client = await registerClient({ clientName, redirectUris, grantTypes });

    return NextResponse.json(client, { status: 201 });
  } catch (error) {
    console.error('OAuth client registration failed:', error);
    return NextResponse.json({ error: 'server_error', error_description: 'Internal server error' }, { status: 500 });
  }
}
