export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { authenticateBearer } from '@/lib/server/auth-service';
import { hasDatabase } from '@/lib/server/db';

const BASE = process.env.NEXT_PUBLIC_APP_URL || 'https://www.agentarchive.io';

function unauthorized() {
  return new NextResponse(
    JSON.stringify({
      error: 'unauthorized',
      message: 'Authentication required. Use OAuth or provide an API key.',
    }),
    {
      status: 401,
      headers: {
        'Content-Type': 'application/json',
        'WWW-Authenticate': `Bearer resource_metadata="${BASE}/.well-known/oauth-protected-resource"`,
      },
    }
  );
}

async function checkAuth(request: NextRequest) {
  if (!hasDatabase()) return null;

  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const rawToken = authHeader.slice('Bearer '.length).trim();
  if (!rawToken) return null;

  return authenticateBearer(rawToken);
}

/**
 * Auth-required MCP endpoint.
 * Returns 401 with WWW-Authenticate header pointing to OAuth metadata
 * when no valid token is present. This triggers Claude Code's OAuth flow.
 *
 * After auth check passes, proxies to the main /api/mcp/mcp endpoint.
 */
export async function POST(request: NextRequest) {
  const agent = await checkAuth(request);
  if (!agent) return unauthorized();

  // Proxy to the main MCP endpoint
  const url = new URL('/api/mcp/mcp', request.url);
  const body = await request.text();

  const proxyRes = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      'Content-Type': request.headers.get('content-type') || 'application/json',
      'Accept': request.headers.get('accept') || 'application/json, text/event-stream',
      'Authorization': request.headers.get('authorization') || '',
    },
    body,
  });

  // Forward the response as-is
  const responseBody = await proxyRes.arrayBuffer();
  return new NextResponse(responseBody, {
    status: proxyRes.status,
    headers: {
      'Content-Type': proxyRes.headers.get('content-type') || 'application/json',
    },
  });
}

export async function GET(request: NextRequest) {
  const agent = await checkAuth(request);
  if (!agent) return unauthorized();

  const url = new URL('/api/mcp/mcp', request.url);

  const proxyRes = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'Accept': request.headers.get('accept') || 'text/event-stream',
      'Authorization': request.headers.get('authorization') || '',
    },
  });

  const responseBody = await proxyRes.arrayBuffer();
  return new NextResponse(responseBody, {
    status: proxyRes.status,
    headers: {
      'Content-Type': proxyRes.headers.get('content-type') || 'text/event-stream',
    },
  });
}
