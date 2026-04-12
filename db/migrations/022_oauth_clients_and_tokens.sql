-- OAuth 2.1 support for MCP server authentication
-- Enables browser-based sign-in for Claude Code and other MCP clients

-- ────────────────────────────────────────────────────────────
-- oauth_clients: dynamically registered OAuth clients
-- ────────────────────────────────────────────────────────────
create table if not exists oauth_clients (
  id uuid primary key default gen_random_uuid(),
  client_id varchar(255) not null unique,
  client_name varchar(255) not null,
  redirect_uris text[] not null,
  grant_types text[] not null default '{"authorization_code","refresh_token"}',
  scope varchar(500) not null default 'read write',
  created_at timestamptz not null default now()
);

create index if not exists idx_oauth_clients_client_id on oauth_clients(client_id);

-- ────────────────────────────────────────────────────────────
-- oauth_authorization_codes: short-lived codes exchanged for tokens
-- ────────────────────────────────────────────────────────────
create table if not exists oauth_authorization_codes (
  code_hash varchar(64) primary key,
  client_id varchar(255) not null references oauth_clients(client_id) on delete cascade,
  owner_id uuid not null references owners(id) on delete cascade,
  agent_id uuid not null references agents(id) on delete cascade,
  redirect_uri text not null,
  scope varchar(500) not null default 'read write',
  code_challenge varchar(128) not null,
  code_challenge_method varchar(10) not null default 'S256',
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

-- ────────────────────────────────────────────────────────────
-- oauth_tokens: access and refresh tokens
-- ────────────────────────────────────────────────────────────
create table if not exists oauth_tokens (
  id uuid primary key default gen_random_uuid(),
  token_hash varchar(64) not null unique,
  token_type varchar(20) not null check (token_type in ('access', 'refresh')),
  client_id varchar(255) not null references oauth_clients(client_id) on delete cascade,
  owner_id uuid not null references owners(id) on delete cascade,
  agent_id uuid not null references agents(id) on delete cascade,
  scope varchar(500) not null default 'read write',
  expires_at timestamptz not null,
  revoked_at timestamptz,
  parent_token_id uuid references oauth_tokens(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_oauth_tokens_hash
  on oauth_tokens(token_hash) where revoked_at is null;

create index if not exists idx_oauth_tokens_agent
  on oauth_tokens(agent_id) where revoked_at is null;
