/**
 * CWE-307 — Brute Force
 *
 * Verifies that checkMemoryRateLimit properly restricts repeated
 * authentication attempts within a time window.
 */
import { checkRateLimit } from '@/lib/server/rate-limit';

describe('CWE-307: brute force protection via rate limiter', () => {
  it('allows requests under the limit', async () => {
    const key = `brute-test-allow-${Date.now()}`;
    const result = await checkRateLimit(key, 5, 60000);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
    expect(result.limit).toBe(5);
  });

  it('blocks requests after limit is reached', async () => {
    const key = `brute-test-block-${Date.now()}`;
    for (let i = 0; i < 3; i++) {
      await checkRateLimit(key, 3, 60000);
    }
    const result = await checkRateLimit(key, 3, 60000);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('tracks remaining count accurately', async () => {
    const key = `brute-test-count-${Date.now()}`;
    const r1 = await checkRateLimit(key, 5, 60000);
    expect(r1.remaining).toBe(4);

    const r2 = await checkRateLimit(key, 5, 60000);
    expect(r2.remaining).toBe(3);

    const r3 = await checkRateLimit(key, 5, 60000);
    expect(r3.remaining).toBe(2);
  });

  it('provides retryAfterMs when blocked', async () => {
    const key = `brute-test-retry-${Date.now()}`;
    for (let i = 0; i < 2; i++) {
      await checkRateLimit(key, 2, 60000);
    }
    const result = await checkRateLimit(key, 2, 60000);
    expect(result.allowed).toBe(false);
    expect(result.retryAfterMs).toBeGreaterThan(0);
  });

  it('uses separate buckets for different keys', async () => {
    const key1 = `brute-test-sep1-${Date.now()}`;
    const key2 = `brute-test-sep2-${Date.now()}`;
    for (let i = 0; i < 3; i++) {
      await checkRateLimit(key1, 3, 60000);
    }
    const blocked = await checkRateLimit(key1, 3, 60000);
    expect(blocked.allowed).toBe(false);

    const allowed = await checkRateLimit(key2, 3, 60000);
    expect(allowed.allowed).toBe(true);
  });

  it('resets bucket after window expires', async () => {
    const key = `brute-test-reset-${Date.now()}`;
    for (let i = 0; i < 2; i++) {
      await checkRateLimit(key, 2, 50);
    }
    const blocked = await checkRateLimit(key, 2, 50);
    expect(blocked.allowed).toBe(false);

    await new Promise((resolve) => setTimeout(resolve, 60));

    const reset = await checkRateLimit(key, 2, 50);
    expect(reset.allowed).toBe(true);
    expect(reset.remaining).toBe(1);
  });
});
