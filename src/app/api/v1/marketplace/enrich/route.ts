import { NextRequest, NextResponse } from 'next/server';
import { enrichMarketplace } from '@/lib/server/marketplace-enrichment';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const expected = process.env.MARKETPLACE_SYNC_SECRET;
    if (!expected) {
      return NextResponse.json(
        { error: 'Enrich endpoint not configured' },
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

    const body = await request.json().catch(() => ({}));

    const stats = await enrichMarketplace({
      batchSize: body.batchSize,
      concurrency: body.concurrency,
      limit: body.limit,
    });

    return NextResponse.json({ success: true, stats });
  } catch (error) {
    console.error('Marketplace enrichment failed:', error);
    return NextResponse.json(
      { error: 'Enrichment failed', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
