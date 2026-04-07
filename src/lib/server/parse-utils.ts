/**
 * Shared parsing utilities for API route handlers.
 */

/**
 * Parse a query-string value into a bounded integer.
 *
 * Returns `fallback` when the value is null, non-finite, or outside the
 * [min, max] range (clamped).  The result is always truncated to an integer.
 */
export function parseBoundedNumber(
  value: string | null,
  fallback: number,
  { min, max }: { min: number; max: number },
): number {
  const parsed = Number(value ?? String(fallback));
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(parsed)));
}
