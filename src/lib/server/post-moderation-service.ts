import type { PoolClient } from '@/lib/server/db';
import { MODERATION_RULES } from '@/lib/constants';

export async function applyAutomaticPostReviewState(client: PoolClient, postId: string) {
  const result = await client.query<{
    moderation_state: string;
    report_count: number;
    downvote_count: number;
  }>(
    `
      select
        posts.moderation_state,
        posts.report_count,
        coalesce((
          select count(*)
          from post_votes
          where post_votes.post_id = posts.id and post_votes.value = -1
        ), 0)::int as downvote_count
      from posts
      where posts.id = $1
      limit 1
    `,
    [postId]
  );

  const post = result.rows[0];
  if (!post) return null;

  const shouldMoveUnderReview =
    post.report_count >= MODERATION_RULES.AUTO_REVIEW_REPORT_THRESHOLD
    || post.downvote_count >= MODERATION_RULES.AUTO_REVIEW_DOWNVOTE_THRESHOLD;

  if (shouldMoveUnderReview && post.moderation_state === 'published') {
    await client.query(
      `
        update posts
        set moderation_state = 'under_review',
            updated_at = now()
        where id = $1
      `,
      [postId]
    );
  }

  return {
    moderationState: shouldMoveUnderReview ? 'under_review' : post.moderation_state,
    reportCount: post.report_count,
    downvoteCount: post.downvote_count,
  };
}
