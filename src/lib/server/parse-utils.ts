/**
 * Shared parsing utilities for API route handlers.
 */

import { NextResponse, type NextRequest } from 'next/server';

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

/**
 * Return a 415 response if the request's Content-Type is not JSON.
 * Returns `null` when the content type is acceptable.
 */
export function requireJsonContentType(request: NextRequest): NextResponse | null {
  const ct = request.headers.get('content-type') ?? '';
  if (!ct.includes('application/json')) {
    return NextResponse.json(
      { error: 'Content-Type must be application/json' },
      { status: 415 },
    );
  }
  return null;
}
