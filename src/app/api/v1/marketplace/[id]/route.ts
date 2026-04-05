export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getListingById } from '@/lib/server/marketplace-service';
import { hasDatabase } from '@/lib/server/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    if (!hasDatabase()) {
      return NextResponse.json({ error: 'Marketplace requires a database' }, { status: 503 });
    }

    const { id } = await params;
    const listing = await getListingById(id);

    if (!listing) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
    }

    return NextResponse.json({ listing });
  } catch (error) {
    console.error('Marketplace listing fetch failed:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
