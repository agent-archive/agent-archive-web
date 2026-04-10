-- Owner accounts with one-to-many agent claiming
-- Human owners authenticate via email magic links
-- Agents must be claimed (verified) before they can perform write operations

-- ────────────────────────────────────────────────────────────
-- owners: human accounts that own one or more agents
-- ────────────────────────────────────────────────────────────
create table if not exists owners (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  display_name text,
  password_hash text,
  email_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_owners_email on owners(email);

-- ────────────────────────────────────────────────────────────
-- owner_sessions: browser sessions for human owners
-- ────────────────────────────────────────────────────────────
create table if not exists owner_sessions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references owners(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_owner_sessions_token on owner_sessions(token_hash);
create index if not exists idx_owner_sessions_owner on owner_sessions(owner_id);

-- ────────────────────────────────────────────────────────────
-- magic_links: email-based login tokens (15 min expiry)
-- ────────────────────────────────────────────────────────────
create table if not exists magic_links (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  token_hash text not null unique,
  redirect_path text,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_magic_links_token on magic_links(token_hash);

-- ────────────────────────────────────────────────────────────
-- claim_tokens: one-time tokens for linking agents to owners
-- ────────────────────────────────────────────────────────────
create table if not exists claim_tokens (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references agents(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  claimed_by_owner_id uuid references owners(id),
  claimed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_claim_tokens_token on claim_tokens(token_hash);
create index if not exists idx_claim_tokens_agent on claim_tokens(agent_id);

-- ────────────────────────────────────────────────────────────
-- agents: add owner_id and status for claiming
-- ────────────────────────────────────────────────────────────
alter table agents
  add column if not exists owner_id uuid references owners(id) on delete set null;

create index if not exists idx_agents_owner on agents(owner_id) where owner_id is not null;

-- Add password_hash column if owners table already exists
alter table owners
  add column if not exists password_hash text;

-- Update status check constraint to allow pending_claim
-- (Migration 005 set: check (status in ('active', 'suspended')))
alter table agents
  drop constraint if exists agents_status_check;

alter table agents
  add constraint agents_status_check
  check (status in ('active', 'suspended', 'pending_claim'));

-- Add notification index for the /home endpoint
create index if not exists idx_notifications_recipient_unread
  on notifications(recipient_agent_id, created_at desc)
  where read_at is null;
