/**
 * CWE-754: Improper Error Handling
 *
 * Verifies that evaluatePostForModeration handles edge cases, missing fields,
 * and exceptional conditions without exposing internal state.
 */

jest.mock('@/lib/server/moderation-store', () => ({
  buildQueueItem: jest.fn((input: any) => ({ id: 'queue-test', ...input })),
}));

import { evaluatePostForModeration } from '@/lib/server/moderation-evaluator';
import type { CreatePostForm } from '@/types';

function basePost(overrides: Partial<CreatePostForm> = {}): CreatePostForm {
  return {
    community: 'test_community',
    title: 'Test Post',
    postType: 'text',
    content: 'Summary: what worked and what failed in this test.',
    systemsInvolved: ['node', 'jest'],
    versionDetails: 'node 22, jest 29',
    ...overrides,
  };
}

describe('CWE-754 – improper error handling in moderation evaluator', () => {
  it('returns needs_revision for posts missing learning shape', () => {
    const result = evaluatePostForModeration(basePost({ content: 'no structured content here' }));
    expect(result.publishState).toBe('published_needs_revision');
    expect(result.queueItem.status).toBe('needs_context');
  });

  it('returns needs_revision for posts missing systems involved', () => {
    const result = evaluatePostForModeration(basePost({ systemsInvolved: [] }));
    expect(result.publishState).toBe('published_needs_revision');
  });

  it('returns needs_revision for posts missing version details', () => {
    const result = evaluatePostForModeration(basePost({ versionDetails: '' }));
    expect(result.publishState).toBe('published_needs_revision');
  });

  it('handles undefined optional fields without throwing', () => {
    const post = basePost({
      systemsInvolved: undefined,
      versionDetails: undefined,
    });
    expect(() => evaluatePostForModeration(post)).not.toThrow();
  });

  it('handles empty title gracefully', () => {
    const result = evaluatePostForModeration(basePost({ title: '' }));
    expect(result.queueItem.title).toBeDefined();
  });

  it('escalates experimental comparisons to human review', () => {
    const result = evaluatePostForModeration(basePost({
      structuredPostType: 'comparison',
      confidence: 'experimental',
    }));
    expect(result.publishState).toBe('escalated_to_human');
    expect(result.queueItem.assignedRole).toBe('human_admin');
  });

  it('flags bug reports without learning path', () => {
    const result = evaluatePostForModeration(basePost({
      structuredPostType: 'bug',
      whatWorked: '',
      whatFailed: '',
    }));
    expect(result.publishState).toBe('published_needs_revision');
  });

  it('approves well-formed posts', () => {
    const result = evaluatePostForModeration(basePost({
      structuredPostType: 'fix',
      whatWorked: 'Restarting the service',
      whatFailed: 'Initial deploy failed',
    }));
    expect(result.publishState).toBe('published_with_review');
    expect(result.queueItem.status).toBe('resolved');
  });
});
