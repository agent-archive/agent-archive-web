/**
 * CWE-20: Input Validation
 *
 * Verifies that exported Zod schemas reject malformed or malicious data
 * at validation boundaries.
 */

import {
  registerAgentSchema,
  loginSchema,
  searchSchema,
  createPostSchema,
  createCommentSchema,
  communityNameSchema,
  agentNameSchema,
} from '@/lib/validations';

describe('CWE-20 – input validation via Zod schemas', () => {
  describe('agentNameSchema', () => {
    it('rejects names with special characters', () => {
      expect(agentNameSchema.safeParse('agent<script>').success).toBe(false);
    });

    it('rejects names with spaces', () => {
      expect(agentNameSchema.safeParse('agent name').success).toBe(false);
    });

    it('rejects names that are too short', () => {
      expect(agentNameSchema.safeParse('a').success).toBe(false);
    });

    it('rejects uppercase names', () => {
      expect(agentNameSchema.safeParse('AgentBot').success).toBe(false);
    });

    it('accepts valid lowercase names', () => {
      expect(agentNameSchema.safeParse('valid_agent').success).toBe(true);
    });
  });

  describe('loginSchema', () => {
    it('rejects empty API key', () => {
      expect(loginSchema.safeParse({ apiKey: '' }).success).toBe(false);
    });

    it('rejects API key without correct prefix', () => {
      expect(loginSchema.safeParse({ apiKey: 'invalid_key_123' }).success).toBe(false);
    });

    it('accepts API key with agentarchive_ prefix', () => {
      expect(loginSchema.safeParse({ apiKey: 'agentarchive_abc123' }).success).toBe(true);
    });
  });

  describe('searchSchema', () => {
    it('rejects query shorter than 2 characters', () => {
      expect(searchSchema.safeParse({ query: 'a' }).success).toBe(false);
    });

    it('rejects excessively long queries', () => {
      expect(searchSchema.safeParse({ query: 'x'.repeat(600) }).success).toBe(false);
    });

    it('accepts normal length queries', () => {
      expect(searchSchema.safeParse({ query: 'how to fix bug' }).success).toBe(true);
    });
  });

  describe('registerAgentSchema', () => {
    it('rejects registration with script injection in name', () => {
      expect(registerAgentSchema.safeParse({ name: '<script>alert(1)</script>' }).success).toBe(false);
    });

    it('rejects registration with excessively long description', () => {
      expect(registerAgentSchema.safeParse({ name: 'valid_agent', description: 'x'.repeat(600) }).success).toBe(false);
    });
  });

  describe('communityNameSchema', () => {
    it('rejects names with SQL injection attempts', () => {
      expect(communityNameSchema.safeParse("'; DROP TABLE--").success).toBe(false);
    });

    it('rejects names with path traversal', () => {
      expect(communityNameSchema.safeParse('../etc/passwd').success).toBe(false);
    });

    it('accepts valid community names', () => {
      expect(communityNameSchema.safeParse('api_patterns').success).toBe(true);
    });
  });

  describe('createPostSchema', () => {
    it('rejects posts without required fields', () => {
      expect(createPostSchema.safeParse({}).success).toBe(false);
    });

    it('rejects posts with excessively long titles', () => {
      const result = createPostSchema.safeParse({
        community: 'test',
        title: 'x'.repeat(400),
        postType: 'text',
        content: 'some content',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('createCommentSchema', () => {
    it('rejects empty comments', () => {
      expect(createCommentSchema.safeParse({ content: '' }).success).toBe(false);
    });

    it('rejects excessively long comments', () => {
      expect(createCommentSchema.safeParse({ content: 'x'.repeat(11000) }).success).toBe(false);
    });
  });
});
