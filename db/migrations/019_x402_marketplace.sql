-- x402 Marketplace: listings + reviews tables
-- Requires pgvector extension for semantic search embeddings

create extension if not exists vector;

-- ────────────────────────────────────────────────────────────
-- x402_listings: one row per unique API endpoint
-- ────────────────────────────────────────────────────────────
create table if not exists x402_listings (
  id                    uuid primary key default gen_random_uuid(),

  -- resource identification
  resource_url          text not null,
  url_hash              text not null unique,

  -- x402 protocol fields
  type                  text not null default 'http',
  x402_version          smallint not null default 1,
  http_method           text,
  mcp_tool_name         text,

  -- raw data from facilitator
  raw_description       text,
  input_schema          jsonb,
  output_schema         jsonb,

  -- pricing (from accepts[0])
  price_amount          text,
  price_asset           text,
  price_token_name      text,
  price_network         text not null,
  price_network_raw     text,
  price_human_readable  text,
  price_decimals        smallint not null default 6,
  pay_to                text,
  max_timeout_seconds   integer,

  -- source tracking (multi-facilitator dedup)
  facilitators          jsonb not null default '[]'::jsonb,

  -- enrichment fields (populated by enrichment pipeline)
  enriched_title        text check (enriched_title is null or char_length(enriched_title) <= 200),
  enriched_description  text check (enriched_description is null or char_length(enriched_description) <= 500),
  enriched_category     text,
  enriched_tags         text[] not null default '{}',
  description_confidence real not null default 0,
  enrichment_source     text,
  enriched_at           timestamptz,

  -- semantic search vector
  embedding             vector(1536),

  -- full-text search (auto-populated by trigger)
  search_vector         tsvector,

  -- trust & quality signals
  avg_rating            real not null default 0,
  review_count          integer not null default 0,
  is_verified           boolean not null default false,
  is_stale              boolean not null default false,
  is_testnet            boolean not null default false,

  -- timestamps
  first_seen_at         timestamptz not null default now(),
  last_seen_at          timestamptz not null default now(),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- ────────────────────────────────────────────────────────────
-- x402_reviews: agent reviews of API listings
-- ────────────────────────────────────────────────────────────
create table if not exists x402_reviews (
  id                    uuid primary key default gen_random_uuid(),
  listing_id            uuid not null references x402_listings(id) on delete cascade,
  author_id             uuid not null,

  -- structured ratings (1–5 scale)
  overall_rating        smallint not null check (overall_rating between 1 and 5),
  reliability           smallint check (reliability is null or reliability between 1 and 5),
  accuracy              smallint check (accuracy is null or accuracy between 1 and 5),
  value                 smallint check (value is null or value between 1 and 5),
  latency               smallint check (latency is null or latency between 1 and 5),
  documentation         smallint check (documentation is null or documentation between 1 and 5),

  -- free-text
  content               text,
  use_case              text,

  -- moderation
  is_flagged            boolean not null default false,
  flag_reason           text,

  -- timestamps
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  -- one review per agent per listing
  unique (listing_id, author_id)
);

-- ────────────────────────────────────────────────────────────
-- indexes: x402_listings
-- ────────────────────────────────────────────────────────────
create index if not exists idx_x402_listings_search_vector
  on x402_listings using gin (search_vector);

create index if not exists idx_x402_listings_embedding
  on x402_listings using hnsw (embedding vector_cosine_ops);

create index if not exists idx_x402_listings_category
  on x402_listings(enriched_category)
  where enriched_category is not null;

create index if not exists idx_x402_listings_type
  on x402_listings(type);

create index if not exists idx_x402_listings_network
  on x402_listings(price_network);

create index if not exists idx_x402_listings_active
  on x402_listings(is_stale, is_testnet)
  where is_stale = false and is_testnet = false;

create index if not exists idx_x402_listings_rating
  on x402_listings(avg_rating desc, review_count desc)
  where review_count > 0;

create index if not exists idx_x402_listings_confidence
  on x402_listings(description_confidence desc);

create index if not exists idx_x402_listings_last_seen
  on x402_listings(last_seen_at desc);

-- ────────────────────────────────────────────────────────────
-- indexes: x402_reviews
-- ────────────────────────────────────────────────────────────
create index if not exists idx_x402_reviews_listing
  on x402_reviews(listing_id, created_at desc);

create index if not exists idx_x402_reviews_author
  on x402_reviews(author_id);

-- ────────────────────────────────────────────────────────────
-- trigger: auto-update search_vector with weighted fields
-- ────────────────────────────────────────────────────────────
create or replace function x402_listings_search_vector_update()
returns trigger as $$
begin
  new.search_vector :=
    setweight(to_tsvector('english', coalesce(new.enriched_title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(new.enriched_description, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(array_to_string(new.enriched_tags, ' '), '')), 'B') ||
    setweight(to_tsvector('english', coalesce(new.raw_description, '')), 'C');
  return new;
end;
$$ language plpgsql;

create trigger trg_x402_listings_search_vector
  before insert or update of enriched_title, enriched_description, raw_description, enriched_tags
  on x402_listings
  for each row
  execute function x402_listings_search_vector_update();

-- ────────────────────────────────────────────────────────────
-- trigger: auto-recompute review stats on the listing
-- ────────────────────────────────────────────────────────────
create or replace function x402_listings_review_stats_update()
returns trigger as $$
declare
  target_id uuid;
begin
  target_id := coalesce(new.listing_id, old.listing_id);
  update x402_listings set
    avg_rating = coalesce((
      select avg(overall_rating)::real
      from x402_reviews
      where listing_id = target_id and not is_flagged
    ), 0),
    review_count = (
      select count(*)
      from x402_reviews
      where listing_id = target_id and not is_flagged
    ),
    updated_at = now()
  where id = target_id;
  return coalesce(new, old);
end;
$$ language plpgsql;

create trigger trg_x402_reviews_stats
  after insert or update or delete
  on x402_reviews
  for each row
  execute function x402_listings_review_stats_update();

-- ────────────────────────────────────────────────────────────
-- trigger: auto-update updated_at on x402_listings
-- ────────────────────────────────────────────────────────────
create or replace function x402_listings_updated_at()
returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

create trigger trg_x402_listings_updated_at
  before update on x402_listings
  for each row
  execute function x402_listings_updated_at();
