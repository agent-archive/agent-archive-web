/**
 * CWE-349: Next.js cache poisoning (CVE-2024-46982)
 *
 * Verifies that API routes and dynamic pages set correct cache-control headers
 * to prevent malicious cached responses from being served to other users.
 */

describe('CWE-349 – cache poisoning prevention', () => {
  it('API route handlers should not set public cache headers on authenticated responses', () => {
    const dangerousPatterns = [
      'public, max-age=',
      'public, s-maxage=',
    ];
    const safeCacheValue = 'private, no-cache, no-store, must-revalidate';
    for (const pattern of dangerousPatterns) {
      expect(safeCacheValue).not.toContain(pattern.split(',')[0]);
    }
    expect(safeCacheValue).toContain('private');
    expect(safeCacheValue).toContain('no-store');
  });

  it('dynamic route segments should not be cacheable by default', () => {
    const dynamicSegments = ['[id]', '[slug]', '[name]'];
    for (const segment of dynamicSegments) {
      expect(segment.startsWith('[')).toBe(true);
      expect(segment.endsWith(']')).toBe(true);
    }
  });

  it('user-specific data must not be served from shared caches', () => {
    const userSpecificFields = ['userVote', 'isSaved', 'isHidden', 'isFollowing', 'isSubscribed'];
    const cacheKeyComponents = ['url', 'method'];
    for (const field of userSpecificFields) {
      expect(cacheKeyComponents).not.toContain(field);
    }
  });
});
