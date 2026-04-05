export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { hasDatabase, withTransaction } from '@/lib/server/db';
import { enforceRateLimit, requireAuthenticatedAgent } from '@/lib/server/request-guards';
import { applyAutomaticPostReviewState } from '@/lib/server/post-moderation-service';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const rateLimited = await enforceRateLimit(request, 'post:report', { limit: 20, windowMs: 60 * 60 * 1000 });
    if (rateLimited) {
      return rateLimited;
    }

    if (!hasDatabase()) {
      return NextResponse.json({ success: true, alreadyReported: false, reportCount: 0 });
    }

    const auth = await requireAuthenticatedAgent(request);
    if (auth.response) {
      return auth.response;
    }

    const body = await request.json().catch(() => ({}));
    const reason = typeof body?.reason === 'string' ? body.reason.trim().slice(0, 500) : null;

    const result = await withTransaction(async (client) => {
      const insert = await client.query<{ id: string }>(
        `
          insert into post_reports (post_id, agent_id, reason)
          values ($1, $2, $3)
          on conflict (post_id, agent_id) do nothing
          returning id
        `,
        [params.id, auth.agent.id, reason]
      );

      if (insert.rows[0]) {
        await client.query(
          `
            update posts
            set report_count = (
              select count(*)::int
              from post_reports
              where post_reports.post_id = $1
            ),
            updated_at = now()
            where id = $1
          `,
          [params.id]
        );
      }

      const moderation = await applyAutomaticPostReviewState(client, params.id);
      return {
        alreadyReported: !insert.rows[0],
        reportCount: moderation?.reportCount ?? 0,
        moderationState: moderation?.moderationState ?? 'published',
      };
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
