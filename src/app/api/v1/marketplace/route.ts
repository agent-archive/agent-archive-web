export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { searchListings } from '@/lib/server/marketplace-service';
import { hasDatabase } from '@/lib/server/db';
import { getSeededMarketplaceListings } from '@/lib/seeded-marketplace';
import { parseBoundedNumber } from '@/lib/server/parse-utils';
import type { MarketplaceListing, MarketplaceSort } from '@/types/marketplace';

const MARKETPLACE_POLICY = 'These are third-party API listings indexed from x402 facilitators. Agent Archive does not operate or guarantee these services.';

const validSorts: MarketplaceSort[] = ['relevant', 'rating', 'price_asc', 'price_desc', 'recent'];

export async function GET(request: NextRequest) {
  try {
    if (!hasDatabase()) {
      const { searchParams } = new URL(request.url);
      const limit = parseBoundedNumber(searchParams.get('limit'), 25, { min: 1, max: 100 });
      const offset = parseBoundedNumber(searchParams.get('offset'), 0, { min: 0, max: 50000 });
      const sort = searchParams.get('sort') as MarketplaceSort | null;
      const { listings, total } = getSeededMarketplaceListings({
        q: searchParams.get('q') || undefined,
        category: searchParams.get('category') || undefined,
        type: (searchParams.get('type') as 'http' | 'mcp') || undefined,
        network: searchParams.get('network') || undefined,
        minRating: searchParams.get('minRating') ? parseFloat(searchParams.get('minRating')!) : undefined,
        maxPrice: searchParams.get('maxPrice') || undefined,
        sort: sort && validSorts.includes(sort) ? sort : 'relevant',
        limit,
        offset,
      });
      return NextResponse.json({
        policy: MARKETPLACE_POLICY,
        listings,
        pagination: { count: listings.length, limit, offset, hasMore: offset + listings.length < total },
      });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseBoundedNumber(searchParams.get('limit'), 25, { min: 1, max: 100 });
    const offset = parseBoundedNumber(searchParams.get('offset'), 0, { min: 0, max: 50000 });

    const sort = searchParams.get('sort') as MarketplaceSort | null;

    const { listings, total } = await searchListings({
      q: searchParams.get('q') || undefined,
      category: (searchParams.get('category') as MarketplaceListing['category']) || undefined,
      type: (searchParams.get('type') as 'http' | 'mcp') || undefined,
      network: searchParams.get('network') || undefined,
      minRating: searchParams.get('minRating') ? parseFloat(searchParams.get('minRating')!) : undefined,
      maxPrice: searchParams.get('maxPrice') || undefined,
      sort: sort && validSorts.includes(sort) ? sort : 'relevant',
      limit,
      offset,
    });

    return NextResponse.json({
      policy: MARKETPLACE_POLICY,
      listings,
      pagination: {
        count: listings.length,
        limit,
        offset,
        hasMore: offset + listings.length < total,
      },
    });
  } catch (error) {
    console.error('Marketplace search failed:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
