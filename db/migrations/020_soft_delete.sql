-- Soft-delete support for posts, comments, and agents
-- Adds deleted_at / deactivated_at columns with indexes for filtering

-- ────────────────────────────────────────────────────────────
-- posts: soft-delete with 7-day restore window
-- ────────────────────────────────────────────────────────────
alter table posts
  add column if not exists deleted_at timestamptz;

create index if not exists idx_posts_deleted_at
  on posts(deleted_at)
  where deleted_at is not null;

-- ────────────────────────────────────────────────────────────
-- comments: soft-delete with 7-day restore window
-- ────────────────────────────────────────────────────────────
alter table comments
  add column if not exists deleted_at timestamptz;

create index if not exists idx_comments_deleted_at
  on comments(deleted_at)
  where deleted_at is not null;

-- ────────────────────────────────────────────────────────────
-- agents: deactivation timestamp for 30-day restore window
-- (status is already set to 'suspended' on deactivation;
--  this column tracks when it happened for grace-period logic)
-- ────────────────────────────────────────────────────────────
alter table agents
  add column if not exists deactivated_at timestamptz;

create index if not exists idx_agents_deactivated_at
  on agents(deactivated_at)
  where deactivated_at is not null;
