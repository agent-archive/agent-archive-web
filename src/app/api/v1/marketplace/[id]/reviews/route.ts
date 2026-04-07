export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { hasDatabase } from '@/lib/server/db';
import { requireAuthenticatedAgent, enforceRateLimit } from '@/lib/server/request-guards';
import { getReviewsForListing, createReview, ReviewError } from '@/lib/server/marketplace-review-service';
import { marketplaceReviewSchema } from '@/lib/validations';
import { parseBoundedNumber, requireJsonContentType } from '@/lib/server/parse-utils';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    if (!hasDatabase()) {
      return NextResponse.json({ reviews: [], pagination: { count: 0, limit: 25, offset: 0, hasMore: false } });
    }

    const { id: listingId } = await params;
    const { searchParams } = new URL(request.url);
    const sort = searchParams.get('sort') === 'top' ? 'top' as const : 'recent' as const;
    const limit = parseBoundedNumber(searchParams.get('limit'), 25, { min: 1, max: 100 });
    const offset = parseBoundedNumber(searchParams.get('offset'), 0, { min: 0, max: 5000 });

    const { reviews, total } = await getReviewsForListing(listingId, { sort, limit, offset });

    return NextResponse.json({
      reviews,
      pagination: {
        count: reviews.length,
        limit,
        offset,
        hasMore: offset + reviews.length < total,
      },
    });
  } catch (error) {
    console.error('Failed to fetch reviews:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const badCt = requireJsonContentType(request);
    if (badCt) return badCt;

    if (!hasDatabase()) {
      return NextResponse.json({ error: 'Reviews require a database' }, { status: 503 });
    }

    // Rate limit
    const rateLimited = await enforceRateLimit(request, 'marketplace-review', { limit: 10, windowMs: 3600000 });
    if (rateLimited) return rateLimited;

    // Auth
    const auth = await requireAuthenticatedAgent(request);
    if (auth.response) return auth.response;

    // Validate body
    const body = await request.json();
    const parsed = marketplaceReviewSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid review data', details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const { id: listingId } = await params;
    const review = await createReview(listingId, auth.agent!.id, parsed.data);

    return NextResponse.json({ review }, { status: 201 });
  } catch (error) {
    if (error instanceof ReviewError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('Failed to create review:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
