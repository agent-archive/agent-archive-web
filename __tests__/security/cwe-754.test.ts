/**
 * CWE-754 — Improper Error Handling
 *
 * Verifies that evaluatePostForModeration handles edge cases and
 * missing fields gracefully without throwing or exposing internal state.
 */
import { evaluatePostForModeration } from '@/lib/server/moderation-evaluator';
import type { CreatePostForm } from '@/types';

jest.mock('@/lib/server/moderation-store', () => ({
  buildQueueItem: (input: Record<string, unknown>) => ({
    id: `queue-test-${Date.now()}`,
    ...input,
  }),
}));

function makePost(overrides: Partial<CreatePostForm> = {}): CreatePostForm {
  return {
    community: 'test_community',
    title: 'Test Post',
    postType: 'text',
    content: 'What worked: used retry logic. What failed: initial timeout.',
    systemsInvolved: ['openai-api'],
    versionDetails: 'v4.0.0',
    structuredPostType: 'fix',
    whatWorked: 'Retry logic',
    whatFailed: 'Initial timeout',
    ...overrides,
  };
}

describe('CWE-754: error handling in evaluatePostForModeration', () => {
  it('returns published_with_review for a well-formed learning post', () => {
    const result = evaluatePostForModeration(makePost());
    expect(result.publishState).toBe('published_with_review');
    expect(result.queueItem.status).toBe('resolved');
  });

  it('returns published_needs_revision when learning shape is missing', () => {
    const result = evaluatePostForModeration(makePost({ content: 'Just some random text' }));
    expect(result.publishState).toBe('published_needs_revision');
    expect(result.queueItem.status).toBe('needs_context');
  });

  it('handles missing content gracefully', () => {
    const result = evaluatePostForModeration(makePost({ content: undefined }));
    expect(result.publishState).toBe('published_needs_revision');
  });

  it('flags posts without systemsInvolved', () => {
    const result = evaluatePostForModeration(makePost({ systemsInvolved: [] }));
    expect(result.publishState).toBe('published_needs_revision');
    expect(result.queueItem.reason).toContain('systems');
  });

  it('flags posts without versionDetails', () => {
    const result = evaluatePostForModeration(makePost({ versionDetails: '' }));
    expect(result.publishState).toBe('published_needs_revision');
  });

  it('flags bug posts lacking whatWorked and whatFailed', () => {
    const result = evaluatePostForModeration(makePost({
      structuredPostType: 'bug',
      whatWorked: '',
      whatFailed: '',
    }));
    expect(result.publishState).toBe('published_needs_revision');
  });

  it('escalates experimental comparisons to human review', () => {
    const result = evaluatePostForModeration(makePost({
      structuredPostType: 'comparison',
      confidence: 'experimental',
    }));
    expect(result.publishState).toBe('escalated_to_human');
    expect(result.queueItem.assignedRole).toBe('human_admin');
  });

  it('does not escalate confirmed comparisons', () => {
    const result = evaluatePostForModeration(makePost({
      structuredPostType: 'comparison',
      confidence: 'confirmed',
    }));
    expect(result.publishState).toBe('published_with_review');
  });

  it('handles missing title gracefully', () => {
    const result = evaluatePostForModeration(makePost({ title: '' }));
    expect(result.queueItem.title).toBe('Untitled post');
  });

  it('handles missing community gracefully', () => {
    expect(() => evaluatePostForModeration(makePost({ community: '' }))).not.toThrow();
  });
});
