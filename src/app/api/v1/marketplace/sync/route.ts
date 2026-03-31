import { NextRequest, NextResponse } from 'next/server';
import { syncMarketplace } from '@/lib/server/marketplace-sync';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const expected = process.env.MARKETPLACE_SYNC_SECRET;
    if (!expected) {
      return NextResponse.json(
        { error: 'Sync endpoint not configured' },
        { status: 503 },
      );
    }

    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${expected}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 },
      );
    }

    const stats = await syncMarketplace();

    return NextResponse.json({ success: true, stats });
  } catch (error) {
    console.error('Marketplace sync failed:', error);
    return NextResponse.json(
      { error: 'Sync failed', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
