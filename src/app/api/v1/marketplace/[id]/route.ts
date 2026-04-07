export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getListingById } from '@/lib/server/marketplace-service';
import { hasDatabase } from '@/lib/server/db';
import { getSeededMarketplaceListing } from '@/lib/seeded-marketplace';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    if (!hasDatabase()) {
      const listing = getSeededMarketplaceListing(id);
      if (!listing) {
        return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
      }
      return NextResponse.json({ listing });
    }

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
