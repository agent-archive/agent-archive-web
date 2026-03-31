import { query } from '@/lib/server/db';
import { analyzePromptInjectionRisk } from '@/lib/server/prompt-injection';
import type { MarketplaceReview } from '@/types/marketplace';

// ────────────────────────────────────────────────────────────
// Row type
// ────────────────────────────────────────────────────────────

interface ReviewRow {
  id: string;
  listing_id: string;
  author_id: string;
  overall_rating: number;
  reliability: number | null;
  accuracy: number | null;
  value: number | null;
  latency: number | null;
  documentation: number | null;
  content: string | null;
  use_case: string | null;
  is_flagged: boolean;
  flag_reason: string | null;
  created_at: string;
  updated_at: string;
}

// ────────────────────────────────────────────────────────────
// Row mapper
// ────────────────────────────────────────────────────────────

function mapReviewRow(row: ReviewRow): MarketplaceReview {
  return {
    id: row.id,
    listingId: row.listing_id,
    authorId: row.author_id,
    overallRating: row.overall_rating,
    reliability: row.reliability ?? undefined,
    accuracy: row.accuracy ?? undefined,
    value: row.value ?? undefined,
    latency: row.latency ?? undefined,
    documentation: row.documentation ?? undefined,
    content: row.content ?? undefined,
    useCase: row.use_case ?? undefined,
    isFlagged: row.is_flagged,
    flagReason: row.flag_reason ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ────────────────────────────────────────────────────────────
// Error class
// ────────────────────────────────────────────────────────────

export class ReviewError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'ReviewError';
  }
}

// ────────────────────────────────────────────────────────────
// Get reviews for a listing
// ────────────────────────────────────────────────────────────

export async function getReviewsForListing(
  listingId: string,
  options?: { sort?: 'recent' | 'top'; limit?: number; offset?: number },
): Promise<{ reviews: MarketplaceReview[]; total: number }> {
  const limit = Math.min(options?.limit ?? 25, 100);
  const offset = options?.offset ?? 0;
  const orderClause = options?.sort === 'top'
    ? 'overall_rating DESC, created_at DESC'
    : 'created_at DESC';

  const [countResult, dataResult] = await Promise.all([
    query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM x402_reviews WHERE listing_id = $1 AND NOT is_flagged`,
      [listingId],
    ),
    query<ReviewRow>(
      `SELECT * FROM x402_reviews
       WHERE listing_id = $1 AND NOT is_flagged
       ORDER BY ${orderClause}
       LIMIT $2 OFFSET $3`,
      [listingId, limit, offset],
    ),
  ]);

  return {
    reviews: dataResult.rows.map(mapReviewRow),
    total: parseInt(countResult.rows[0]?.count ?? '0', 10),
  };
}

// ────────────────────────────────────────────────────────────
// Create a review
// ────────────────────────────────────────────────────────────

interface CreateReviewInput {
  overallRating: number;
  reliability?: number;
  accuracy?: number;
  value?: number;
  latency?: number;
  documentation?: number;
  content?: string;
  useCase?: string;
}

export async function createReview(
  listingId: string,
  authorId: string,
  input: CreateReviewInput,
): Promise<MarketplaceReview> {
  // Verify listing exists
  const listingCheck = await query<{ id: string }>(
    `SELECT id FROM x402_listings WHERE id = $1`,
    [listingId],
  );
  if (listingCheck.rows.length === 0) {
    throw new ReviewError('Listing not found', 404);
  }

  // Moderation
  let isFlagged = false;
  let flagReason: string | null = null;

  if (input.content || input.useCase) {
    const analysis = analyzePromptInjectionRisk([input.content, input.useCase]);
    if (analysis.risk === 'high') {
      throw new ReviewError('Review content was rejected by moderation', 400);
    }
    if (analysis.risk === 'medium') {
      isFlagged = true;
      flagReason = `Flagged for review: ${analysis.signals.join(', ')}`;
    }
  }

  try {
    const result = await query<ReviewRow>(
      `INSERT INTO x402_reviews (
        listing_id, author_id, overall_rating, reliability, accuracy,
        value, latency, documentation, content, use_case,
        is_flagged, flag_reason
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *`,
      [
        listingId, authorId, input.overallRating,
        input.reliability ?? null, input.accuracy ?? null,
        input.value ?? null, input.latency ?? null,
        input.documentation ?? null, input.content ?? null,
        input.useCase ?? null, isFlagged, flagReason,
      ],
    );

    return mapReviewRow(result.rows[0]);
  } catch (err: unknown) {
    const pgErr = err as { code?: string };
    if (pgErr.code === '23505') {
      throw new ReviewError('You have already reviewed this listing', 409);
    }
    throw err;
  }
}

// ────────────────────────────────────────────────────────────
// Update a review
// ────────────────────────────────────────────────────────────

export async function updateReview(
  reviewId: string,
  authorId: string,
  input: Partial<CreateReviewInput>,
): Promise<MarketplaceReview> {
  const existing = await query<ReviewRow>(
    `SELECT * FROM x402_reviews WHERE id = $1`,
    [reviewId],
  );
  if (existing.rows.length === 0) {
    throw new ReviewError('Review not found', 404);
  }
  if (existing.rows[0].author_id !== authorId) {
    throw new ReviewError('Forbidden', 403);
  }

  // Re-run moderation on updated text
  let isFlagged = existing.rows[0].is_flagged;
  let flagReason = existing.rows[0].flag_reason;

  if (input.content !== undefined || input.useCase !== undefined) {
    const newContent = input.content ?? existing.rows[0].content;
    const newUseCase = input.useCase ?? existing.rows[0].use_case;
    const analysis = analyzePromptInjectionRisk([newContent, newUseCase]);
    if (analysis.risk === 'high') {
      throw new ReviewError('Review content was rejected by moderation', 400);
    }
    if (analysis.risk === 'medium') {
      isFlagged = true;
      flagReason = `Flagged for review: ${analysis.signals.join(', ')}`;
    } else {
      isFlagged = false;
      flagReason = null;
    }
  }

  const result = await query<ReviewRow>(
    `UPDATE x402_reviews SET
      overall_rating = COALESCE($2, overall_rating),
      reliability = COALESCE($3, reliability),
      accuracy = COALESCE($4, accuracy),
      value = COALESCE($5, value),
      latency = COALESCE($6, latency),
      documentation = COALESCE($7, documentation),
      content = COALESCE($8, content),
      use_case = COALESCE($9, use_case),
      is_flagged = $10,
      flag_reason = $11,
      updated_at = NOW()
    WHERE id = $1
    RETURNING *`,
    [
      reviewId,
      input.overallRating ?? null, input.reliability ?? null,
      input.accuracy ?? null, input.value ?? null,
      input.latency ?? null, input.documentation ?? null,
      input.content ?? null, input.useCase ?? null,
      isFlagged, flagReason,
    ],
  );

  return mapReviewRow(result.rows[0]);
}

// ────────────────────────────────────────────────────────────
// Delete a review
// ────────────────────────────────────────────────────────────

export async function deleteReview(reviewId: string, authorId: string): Promise<void> {
  const existing = await query<ReviewRow>(
    `SELECT * FROM x402_reviews WHERE id = $1`,
    [reviewId],
  );
  if (existing.rows.length === 0) {
    throw new ReviewError('Review not found', 404);
  }
  if (existing.rows[0].author_id !== authorId) {
    throw new ReviewError('Forbidden', 403);
  }

  await query(`DELETE FROM x402_reviews WHERE id = $1`, [reviewId]);
}
