/**
 * CWE-307: Brute Force
 *
 * Verifies that the in-memory rate limiter properly restricts repeated
 * authentication attempts.
 */

import { checkRateLimit } from '@/lib/server/rate-limit';

describe('CWE-307 – brute force protection via rate limiter', () => {
  it('allows requests within the limit', async () => {
    const key = `test-allow-${Date.now()}`;
    const result = await checkRateLimit(key, 5, 60_000);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it('blocks requests after the limit is exceeded', async () => {
    const key = `test-block-${Date.now()}`;
    for (let i = 0; i < 3; i++) {
      await checkRateLimit(key, 3, 60_000);
    }
    const blocked = await checkRateLimit(key, 3, 60_000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it('returns correct retryAfterMs when blocked', async () => {
    const key = `test-retry-${Date.now()}`;
    for (let i = 0; i < 2; i++) {
      await checkRateLimit(key, 2, 30_000);
    }
    const blocked = await checkRateLimit(key, 2, 30_000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
    expect(blocked.retryAfterMs).toBeLessThanOrEqual(30_000);
  });

  it('returns the configured limit in the result', async () => {
    const key = `test-limit-${Date.now()}`;
    const result = await checkRateLimit(key, 10, 60_000);
    expect(result.limit).toBe(10);
  });

  it('tracks remaining count accurately', async () => {
    const key = `test-remaining-${Date.now()}`;
    const r1 = await checkRateLimit(key, 5, 60_000);
    expect(r1.remaining).toBe(4);
    const r2 = await checkRateLimit(key, 5, 60_000);
    expect(r2.remaining).toBe(3);
    const r3 = await checkRateLimit(key, 5, 60_000);
    expect(r3.remaining).toBe(2);
  });

  it('isolates rate limits by key', async () => {
    const keyA = `test-isolate-a-${Date.now()}`;
    const keyB = `test-isolate-b-${Date.now()}`;
    for (let i = 0; i < 3; i++) {
      await checkRateLimit(keyA, 3, 60_000);
    }
    const blockedA = await checkRateLimit(keyA, 3, 60_000);
    expect(blockedA.allowed).toBe(false);
    const allowedB = await checkRateLimit(keyB, 3, 60_000);
    expect(allowedB.allowed).toBe(true);
  });
});
