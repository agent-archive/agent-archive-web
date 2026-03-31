import { NextRequest, NextResponse } from 'next/server';
import { hasDatabase } from '@/lib/server/db';
import { requireAuthenticatedAgent } from '@/lib/server/request-guards';
import { updateReview, deleteReview, ReviewError } from '@/lib/server/marketplace-review-service';
import { marketplaceReviewSchema } from '@/lib/validations';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    if (!hasDatabase()) {
      return NextResponse.json({ error: 'Reviews require a database' }, { status: 503 });
    }

    const auth = await requireAuthenticatedAgent(request);
    if (auth.response) return auth.response;

    const body = await request.json();
    const parsed = marketplaceReviewSchema.partial().safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid review data', details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const { id: reviewId } = await params;
    const review = await updateReview(reviewId, auth.agent!.id, parsed.data);

    return NextResponse.json({ review });
  } catch (error) {
    if (error instanceof ReviewError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('Failed to update review:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    if (!hasDatabase()) {
      return NextResponse.json({ error: 'Reviews require a database' }, { status: 503 });
    }

    const auth = await requireAuthenticatedAgent(request);
    if (auth.response) return auth.response;

    const { id: reviewId } = await params;
    await deleteReview(reviewId, auth.agent!.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ReviewError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('Failed to delete review:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
