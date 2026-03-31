'use client';

import { useState, useEffect, useCallback } from 'react';
import { Star } from 'lucide-react';
import { useAuth } from '@/hooks';
import { Card, Button, Textarea } from '@/components/ui';
import type { MarketplaceReview } from '@/types/marketplace';

// ────────────────────────────────────────────────────────────
// Star rating picker
// ────────────────────────────────────────────────────────────

function StarRating({ value, onChange, size = 'md' }: { value: number; onChange?: (v: number) => void; size?: 'sm' | 'md' }) {
  const [hover, setHover] = useState(0);
  const sizeClass = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5';

  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange?.(star)}
          onMouseEnter={() => onChange && setHover(star)}
          onMouseLeave={() => onChange && setHover(0)}
          className={onChange ? 'cursor-pointer' : 'cursor-default'}
          disabled={!onChange}
        >
          <Star
            className={`${sizeClass} transition-colors ${
              star <= (hover || value)
                ? 'fill-yellow-400 text-yellow-400'
                : 'text-muted-foreground/30'
            }`}
          />
        </button>
      ))}
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Sub-rating row
// ────────────────────────────────────────────────────────────

function SubRatingInput({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted-foreground">{label}</span>
      <StarRating value={value} onChange={onChange} size="sm" />
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Review card
// ────────────────────────────────────────────────────────────

function ReviewCard({ review }: { review: MarketplaceReview }) {
  return (
    <div className="border-b border-border/50 py-4 last:border-0">
      <div className="flex items-center gap-2 mb-1">
        <StarRating value={review.overallRating} size="sm" />
        <span className="text-xs text-muted-foreground">
          {new Date(review.createdAt).toLocaleDateString()}
        </span>
      </div>
      {review.content && (
        <p className="text-sm mt-1">{review.content}</p>
      )}
      {review.useCase && (
        <p className="text-xs text-muted-foreground mt-1">
          <span className="font-medium">Use case:</span> {review.useCase}
        </p>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Main reviews component
// ────────────────────────────────────────────────────────────

export function MarketplaceReviews({ listingId }: { listingId: string }) {
  const { isAuthenticated } = useAuth();
  const [reviews, setReviews] = useState<MarketplaceReview[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Form state
  const [overallRating, setOverallRating] = useState(0);
  const [reliability, setReliability] = useState(0);
  const [accuracy, setAccuracy] = useState(0);
  const [value, setValue] = useState(0);
  const [latency, setLatency] = useState(0);
  const [documentation, setDocumentation] = useState(0);
  const [content, setContent] = useState('');
  const [useCase, setUseCase] = useState('');

  const fetchReviews = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/marketplace/${listingId}/reviews?sort=recent&limit=50`);
      const data = await res.json();
      setReviews(data.reviews ?? []);
      setTotal(data.pagination?.count ?? 0);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [listingId]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (overallRating === 0) {
      setError('Please select an overall rating');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const body: Record<string, unknown> = { overallRating };
      if (reliability > 0) body.reliability = reliability;
      if (accuracy > 0) body.accuracy = accuracy;
      if (value > 0) body.value = value;
      if (latency > 0) body.latency = latency;
      if (documentation > 0) body.documentation = documentation;
      if (content.trim()) body.content = content.trim();
      if (useCase.trim()) body.useCase = useCase.trim();

      const res = await fetch(`/api/v1/marketplace/${listingId}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to submit review');
      }

      setSuccess(true);
      setOverallRating(0);
      setReliability(0);
      setAccuracy(0);
      setValue(0);
      setLatency(0);
      setDocumentation(0);
      setContent('');
      setUseCase('');
      await fetchReviews();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="font-display text-xl font-semibold">
        Reviews {total > 0 && <span className="text-muted-foreground font-normal">({total})</span>}
      </h2>

      {/* Review form */}
      {isAuthenticated ? (
        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-3">Leave a review</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Overall rating *</label>
              <StarRating value={overallRating} onChange={setOverallRating} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <SubRatingInput label="Reliability" value={reliability} onChange={setReliability} />
              <SubRatingInput label="Accuracy" value={accuracy} onChange={setAccuracy} />
              <SubRatingInput label="Value" value={value} onChange={setValue} />
              <SubRatingInput label="Latency" value={latency} onChange={setLatency} />
              <SubRatingInput label="Documentation" value={documentation} onChange={setDocumentation} />
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Review</label>
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="What was your experience with this API?"
                rows={3}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Use case</label>
              <Textarea
                value={useCase}
                onChange={(e) => setUseCase(e.target.value)}
                placeholder="What were you trying to accomplish?"
                rows={2}
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
            {success && <p className="text-sm text-green-600 dark:text-green-400">Review submitted!</p>}

            <Button type="submit" disabled={submitting || overallRating === 0}>
              {submitting ? 'Submitting...' : 'Submit Review'}
            </Button>
          </form>
        </Card>
      ) : (
        <Card className="p-4 text-center text-sm text-muted-foreground">
          Log in to leave a review
        </Card>
      )}

      {/* Review list */}
      {loading ? (
        <div className="text-sm text-muted-foreground">Loading reviews...</div>
      ) : reviews.length > 0 ? (
        <div>
          {reviews.map((review) => (
            <ReviewCard key={review.id} review={review} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No reviews yet. Be the first to review this API.</p>
      )}
    </div>
  );
}
