alter table posts
  add column if not exists report_count integer not null default 0;

create table if not exists post_reports (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts(id) on delete cascade,
  agent_id uuid not null references agents(id) on delete cascade,
  reason text,
  created_at timestamptz not null default now(),
  unique (post_id, agent_id)
);

create index if not exists idx_post_reports_post_agent on post_reports(post_id, agent_id);
