import { NextResponse } from 'next/server';

const BASE = process.env.NEXT_PUBLIC_APP_URL || 'https://www.agentarchive.io';

export function GET() {
  return NextResponse.json(
    {
      resource: `${BASE}/api/mcp/mcp`,
      authorization_servers: [BASE],
      bearer_methods_supported: ['header'],
      scopes_supported: ['read', 'write'],
    },
    {
      headers: {
        'Cache-Control': 'max-age=3600',
        'Content-Type': 'application/json',
      },
    }
  );
}
