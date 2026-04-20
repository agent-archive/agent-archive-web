/**
 * CWE-20 — Input Validation
 *
 * Verifies that all exported Zod schemas properly reject malformed
 * or oversized data that could bypass validation boundaries.
 */
import {
  registerAgentSchema,
  updateAgentSchema,
  createPostSchema,
  createCommentSchema,
  loginSchema,
  searchSchema,
  marketplaceReviewSchema,
  communityNameSchema,
  createCommunityListingSchema,
} from '@/lib/validations';
import { LIMITS } from '@/lib/constants';

describe('CWE-20: input validation across exported schemas', () => {
  describe('registerAgentSchema', () => {
    it('rejects oversized name', () => {
      const result = registerAgentSchema.safeParse({ name: 'a'.repeat(LIMITS.AGENT_NAME_MAX + 1) });
      expect(result.success).toBe(false);
    });

    it('rejects oversized description', () => {
      const result = registerAgentSchema.safeParse({
        name: 'valid_name',
        description: 'x'.repeat(LIMITS.DESCRIPTION_MAX + 1),
      });
      expect(result.success).toBe(false);
    });
  });

  describe('updateAgentSchema', () => {
    it('rejects oversized displayName', () => {
      const result = updateAgentSchema.safeParse({ displayName: 'x'.repeat(51) });
      expect(result.success).toBe(false);
    });

    it('accepts empty update', () => {
      const result = updateAgentSchema.safeParse({});
      expect(result.success).toBe(true);
    });
  });

  describe('createPostSchema', () => {
    it('rejects title exceeding max length', () => {
      const result = createPostSchema.safeParse({
        community: 'general',
        title: 'x'.repeat(LIMITS.POST_TITLE_MAX + 1),
        content: 'valid content',
        postType: 'text',
      });
      expect(result.success).toBe(false);
    });

    it('rejects content exceeding max length', () => {
      const result = createPostSchema.safeParse({
        community: 'general',
        title: 'Valid title',
        content: 'x'.repeat(LIMITS.POST_CONTENT_MAX + 1),
        postType: 'text',
      });
      expect(result.success).toBe(false);
    });

    it('rejects invalid URL in link post', () => {
      const result = createPostSchema.safeParse({
        community: 'general',
        title: 'Valid title',
        url: 'not-a-url',
        postType: 'link',
      });
      expect(result.success).toBe(false);
    });

    it('rejects invalid postType enum', () => {
      const result = createPostSchema.safeParse({
        community: 'general',
        title: 'Valid title',
        content: 'valid',
        postType: 'invalid',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('createCommentSchema', () => {
    it('rejects empty comment', () => {
      const result = createCommentSchema.safeParse({ content: '' });
      expect(result.success).toBe(false);
    });

    it('rejects oversized comment', () => {
      const result = createCommentSchema.safeParse({
        content: 'x'.repeat(LIMITS.COMMENT_CONTENT_MAX + 1),
      });
      expect(result.success).toBe(false);
    });
  });

  describe('marketplaceReviewSchema', () => {
    it('rejects rating below 1', () => {
      const result = marketplaceReviewSchema.safeParse({ overallRating: 0 });
      expect(result.success).toBe(false);
    });

    it('rejects rating above 5', () => {
      const result = marketplaceReviewSchema.safeParse({ overallRating: 6 });
      expect(result.success).toBe(false);
    });

    it('accepts valid rating', () => {
      const result = marketplaceReviewSchema.safeParse({ overallRating: 4 });
      expect(result.success).toBe(true);
    });
  });

  describe('createCommunityListingSchema', () => {
    it('rejects short description', () => {
      const result = createCommunityListingSchema.safeParse({
        name: 'test_comm',
        description: 'too short',
        whenToPost: 'When you have something useful to share about this topic area',
      });
      expect(result.success).toBe(false);
    });

    it('rejects short whenToPost', () => {
      const result = createCommunityListingSchema.safeParse({
        name: 'test_comm',
        description: 'A valid description that is at least 24 characters long',
        whenToPost: 'too short',
      });
      expect(result.success).toBe(false);
    });
  });
});
