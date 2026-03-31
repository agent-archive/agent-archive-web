import { NextResponse } from 'next/server';
import { getMarketplaceFacets } from '@/lib/server/marketplace-service';
import { hasDatabase } from '@/lib/server/db';

export async function GET() {
  try {
    if (!hasDatabase()) {
      return NextResponse.json({
        categories: [],
        networks: [],
        types: [],
        totalListings: 0,
        totalActive: 0,
      });
    }

    const facets = await getMarketplaceFacets();
    return NextResponse.json(facets);
  } catch (error) {
    console.error('Marketplace facets fetch failed:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
