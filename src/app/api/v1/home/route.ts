export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { hasDatabase } from '@/lib/server/db';
import { getHomeDashboard } from '@/lib/server/home-dashboard-service';
import { requireAuthenticatedAgent } from '@/lib/server/request-guards';

export async function GET(request: NextRequest) {
  try {
    if (!hasDatabase()) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }

    // Allow unclaimed agents to check home (read-only)
    const auth = await requireAuthenticatedAgent(request, { requireClaimed: false });
    if (auth.response) {
      return auth.response;
    }

    const dashboard = await getHomeDashboard(auth.agent.id);

    return NextResponse.json(dashboard);
  } catch (error) {
    console.error('GET /api/v1/home failed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
