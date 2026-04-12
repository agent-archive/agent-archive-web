export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { hasDatabase } from '@/lib/server/db';
import { exchangeAuthorizationCode, refreshAccessToken } from '@/lib/server/oauth-service';
import { enforceRateLimit } from '@/lib/server/request-guards';

export async function POST(request: NextRequest) {
  try {
    if (!hasDatabase()) {
      return NextResponse.json({ error: 'server_error', error_description: 'Not available' }, { status: 503 });
    }

    const rateLimited = await enforceRateLimit(request, 'oauth:token', { limit: 30, windowMs: 60 * 60 * 1000 });
    if (rateLimited) return rateLimited;

    // OAuth token endpoint uses application/x-www-form-urlencoded
    const contentType = request.headers.get('content-type') || '';
    let params: Record<string, string>;

    if (contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await request.formData();
      params = Object.fromEntries(formData.entries()) as Record<string, string>;
    } else if (contentType.includes('application/json')) {
      params = await request.json();
    } else {
      // Try form data as fallback
      const text = await request.text();
      params = Object.fromEntries(new URLSearchParams(text).entries());
    }

    const grantType = params.grant_type;

    if (grantType === 'authorization_code') {
      const code = params.code;
      const redirectUri = params.redirect_uri;
      const clientId = params.client_id;
      const codeVerifier = params.code_verifier;

      if (!code || !redirectUri || !clientId || !codeVerifier) {
        return NextResponse.json(
          { error: 'invalid_request', error_description: 'Missing required parameters: code, redirect_uri, client_id, code_verifier' },
          { status: 400 }
        );
      }

      const result = await exchangeAuthorizationCode({ code, clientId, redirectUri, codeVerifier });

      if ('error' in result) {
        return NextResponse.json(result, { status: 400 });
      }

      return NextResponse.json(result, {
        headers: { 'Cache-Control': 'no-store', 'Pragma': 'no-cache' },
      });
    }

    if (grantType === 'refresh_token') {
      const refreshToken = params.refresh_token;
      const clientId = params.client_id;

      if (!refreshToken || !clientId) {
        return NextResponse.json(
          { error: 'invalid_request', error_description: 'Missing required parameters: refresh_token, client_id' },
          { status: 400 }
        );
      }

      const result = await refreshAccessToken({ refreshToken, clientId });

      if ('error' in result) {
        return NextResponse.json(result, { status: 400 });
      }

      return NextResponse.json(result, {
        headers: { 'Cache-Control': 'no-store', 'Pragma': 'no-cache' },
      });
    }

    return NextResponse.json(
      { error: 'unsupported_grant_type', error_description: `Grant type "${grantType}" is not supported` },
      { status: 400 }
    );
  } catch (error) {
    console.error('OAuth token exchange failed:', error);
    return NextResponse.json({ error: 'server_error', error_description: 'Internal server error' }, { status: 500 });
  }
}
