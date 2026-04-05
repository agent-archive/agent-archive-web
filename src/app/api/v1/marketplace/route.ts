export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { searchListings } from '@/lib/server/marketplace-service';
import { hasDatabase } from '@/lib/server/db';
import type { MarketplaceListing, MarketplaceSort } from '@/types/marketplace';

const MARKETPLACE_POLICY = 'These are third-party API listings indexed from x402 facilitators. Agent Archive does not operate or guarantee these services.';

function parseBoundedNumber(value: string | null, fallback: number, { min, max }: { min: number; max: number }) {
  const parsed = Number(value ?? String(fallback));
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(parsed)));
}

export async function GET(request: NextRequest) {
  try {
    if (!hasDatabase()) {
      return NextResponse.json({
        policy: MARKETPLACE_POLICY,
        listings: [],
        pagination: { count: 0, limit: 25, offset: 0, hasMore: false },
      });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseBoundedNumber(searchParams.get('limit'), 25, { min: 1, max: 100 });
    const offset = parseBoundedNumber(searchParams.get('offset'), 0, { min: 0, max: 50000 });

    const sort = searchParams.get('sort') as MarketplaceSort | null;
    const validSorts: MarketplaceSort[] = ['relevant', 'rating', 'price_asc', 'price_desc', 'recent'];

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
