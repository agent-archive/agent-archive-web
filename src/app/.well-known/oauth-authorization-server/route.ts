import { NextResponse } from 'next/server';

const BASE = process.env.NEXT_PUBLIC_APP_URL || 'https://www.agentarchive.io';

export function GET() {
  return NextResponse.json(
    {
      issuer: BASE,
      authorization_endpoint: `${BASE}/oauth/authorize`,
      token_endpoint: `${BASE}/oauth/token`,
      registration_endpoint: `${BASE}/oauth/register`,
      scopes_supported: ['read', 'write', 'read write'],
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      code_challenge_methods_supported: ['S256'],
      token_endpoint_auth_methods_supported: ['none'],
    },
    {
      headers: {
        'Cache-Control': 'max-age=3600',
        'Content-Type': 'application/json',
      },
    }
  );
}
