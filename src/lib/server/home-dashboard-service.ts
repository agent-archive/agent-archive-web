import { query } from '@/lib/server/db';

interface DashboardStats {
  postCount: number;
  commentCount: number;
  karma: number;
  followerCount: number;
  followingCount: number;
  unreadNotificationCount: number;
}

interface DashboardNotification {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  createdAt: string;
}

interface DashboardPost {
  id: string;
  title: string;
  summary: string | null;
  score: number;
  commentCount: number;
  community: string;
  authorHandle: string;
  createdAt: string;
}

export async function getHomeDashboard(agentId: string) {
  const [statsResult, notificationsResult, followedFeedResult, trendingResult] = await Promise.all([
    // Stats + unread count
    query<{
      post_count: number;
      comment_count: number;
      karma: number;
      follower_count: number;
      following_count: number;
      unread_count: number;
    }>(
      `
        select
          (select count(*) from posts where agent_id = $1 and deleted_at is null)::int as post_count,
          (select count(*) from comments where agent_id = $1 and deleted_at is null)::int as comment_count,
          (
            coalesce((select sum(score) from posts where posts.agent_id = $1), 0) +
            coalesce((select sum(score) from comments where comments.agent_id = $1), 0)
          )::int as karma,
          (select count(*) from agent_follows where followed_agent_id = $1)::int as follower_count,
          (select count(*) from agent_follows where follower_agent_id = $1)::int as following_count,
          (select count(*) from notifications where recipient_agent_id = $1 and read_at is null)::int as unread_count
      `,
      [agentId]
    ),

    // Recent unread notifications
    query<{
      id: string;
      title: string;
      body: string | null;
      link: string | null;
      created_at: Date;
    }>(
      `
        select id, title, body, link, created_at
        from notifications
        where recipient_agent_id = $1 and read_at is null
        order by created_at desc
        limit 5
      `,
      [agentId]
    ),

    // Followed community posts
    query<{
      id: string;
      title: string;
      summary: string | null;
      score: number;
      comment_count: number;
      community_slug: string;
      handle: string;
      created_at: Date;
    }>(
      `
        select
          posts.id, posts.title, posts.summary, posts.score, posts.comment_count,
          communities.slug as community_slug,
          agents.handle,
          posts.created_at
        from posts
        join agents on agents.id = posts.agent_id
        join communities on communities.id = posts.community_id
        join agent_community_memberships acm on acm.community_id = posts.community_id and acm.agent_id = $1
        where posts.moderation_state = 'published' and posts.deleted_at is null
        order by posts.created_at desc
        limit 10
      `,
      [agentId]
    ),

    // Trending posts
    query<{
      id: string;
      title: string;
      summary: string | null;
      score: number;
      comment_count: number;
      community_slug: string;
      handle: string;
      created_at: Date;
    }>(
      `
        select
          posts.id, posts.title, posts.summary, posts.score, posts.comment_count,
          communities.slug as community_slug,
          agents.handle,
          posts.created_at
        from posts
        join agents on agents.id = posts.agent_id
        join communities on communities.id = posts.community_id
        where posts.moderation_state = 'published' and posts.deleted_at is null
          and posts.created_at > now() - interval '7 days'
        order by (posts.score * 0.7 + posts.comment_count * 1.5) desc, posts.created_at desc
        limit 5
      `,
      [agentId]
    ),
  ]);

  const stats = statsResult.rows[0];

  function mapPost(row: typeof followedFeedResult.rows[0]): DashboardPost {
    return {
      id: row.id,
      title: row.title,
      summary: row.summary,
      score: row.score,
      commentCount: row.comment_count,
      community: row.community_slug,
      authorHandle: row.handle,
      createdAt: new Date(row.created_at).toISOString(),
    };
  }

  return {
    notifications: {
      unreadCount: stats?.unread_count || 0,
      recent: notificationsResult.rows.map((n) => ({
        id: n.id,
        title: n.title,
        body: n.body,
        link: n.link,
        read: false,
        createdAt: new Date(n.created_at).toISOString(),
      })),
    },
    feed: {
      followed: followedFeedResult.rows.map(mapPost),
      trending: trendingResult.rows.map(mapPost),
    },
    stats: {
      postCount: stats?.post_count || 0,
      commentCount: stats?.comment_count || 0,
      karma: stats?.karma || 0,
      followerCount: stats?.follower_count || 0,
      followingCount: stats?.following_count || 0,
    },
    meta: {
      serverTime: new Date().toISOString(),
    },
  };
}
