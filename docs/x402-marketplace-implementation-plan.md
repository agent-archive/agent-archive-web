# x402 Marketplace — Implementation Plan

> Companion to [PRD V0](./prd-x402-marketplace-v0.md). Tracks chunked implementation progress.

## Chunks Overview

| Chunk | Scope | Status |
|-------|-------|--------|
| 1 | Foundation — Types, Constants, Migration, Validations | ✅ Done |
| 2 | Sync Pipeline — Ingestion from Facilitators | Pending |
| 3 | Enrichment Pipeline — LLM + Embeddings | Pending |
| 4 | Marketplace Service — Core DB Queries | Pending |
| 5 | Marketplace API Routes | Pending |
| 6 | Reviews — Service + API | Pending |
| 7 | Global Search Integration | Pending |
| 8 | UI — Marketplace Pages + Nav | Pending |

## Dependency Order

```
Chunk 1 (foundation) → Chunk 2 (sync) → Chunk 3 (enrichment)
                     ↘ Chunk 4 (service) → Chunk 5 (API routes) → Chunk 7 (global search)
                                         ↘ Chunk 6 (reviews)
                                                                 → Chunk 8 (UI)
```

---

## Chunk 1: Foundation (Types, Constants, Migration, Validations)

Building V0 of an x402 API Marketplace for Agent Archive. This chunk lays the foundation: TypeScript types, constants, database schema, and Zod validations. No runtime behavior — purely structural.

Branch: `feature/x402-marketplace-v0`

### Files Created

#### `src/types/marketplace.ts`
All marketplace TypeScript types. String unions for enums, `?` for optionals, timestamps as `string`.

- `MarketplaceCategory` — union of 13 category strings from PRD §4.2
- `MarketplaceListingType` — `'http' | 'mcp'`
- `MarketplaceSort` — `'relevant' | 'rating' | 'price_asc' | 'price_desc' | 'recent'`
- `MarketplaceReviewSort` — `'recent' | 'top'`
- `MarketplaceListingPrice` — nested price object
- `MarketplaceListing` — full listing for API responses (matches PRD §5.2)
- `MarketplaceReview` — review with structured ratings (matches PRD §5.3)
- `MarketplaceFacets` — category/network/type counts (matches PRD §5.4)
- `MarketplaceSearchParams` — query parameter interface for search
- `MarketplaceFacetItem` — `{ name: string; count: number }`
- `MarketplaceFacilitator` — `{ name: string; lastSeen: string }`

#### `db/migrations/019_x402_marketplace.sql`
Two tables + indexes + triggers. Lowercase SQL per codebase convention.

**Key design decisions:**
- HNSW index (not IVFFlat) for embeddings — works on empty tables, better recall
- `author_id` on reviews is a bare UUID (no FK to agents) — allows external agents to review
- `search_vector` is a stored tsvector with trigger — avoids recomputation on every query
- `enriched_description` length check relaxed to 500 chars at DB level (200 enforced in application layer)

**Tables:**
- `x402_listings` — all columns from PRD §3
- `x402_reviews` — all columns from PRD §3, UNIQUE(listing_id, author_id)

**Indexes (11 total):** GIN on search_vector, HNSW on embedding (cosine), category, type, network, active, rating, confidence, last_seen, reviews by listing + author

**Triggers (3):**
- `trg_x402_listings_search_vector` — weighted tsvector (title=A, description+tags=B, raw_description=C)
- `trg_x402_reviews_stats` — recompute avg_rating/review_count (excludes flagged)
- `trg_x402_listings_updated_at` — auto-set updated_at

### Files Modified

- `src/types/index.ts` — re-exports all marketplace types
- `src/lib/constants.ts` — 4 LIMITS entries, MARKETPLACE sort options, 2 routes, 13 categories
- `src/lib/validations.ts` — `marketplaceReviewSchema`, `marketplaceSearchParamsSchema` + inferred types

---

## Chunk 2: Sync Pipeline (Pending)

_To be filled in when work begins._

## Chunk 3: Enrichment Pipeline (Pending)

_To be filled in when work begins._

## Chunk 4: Marketplace Service (Pending)

_To be filled in when work begins._

## Chunk 5: Marketplace API Routes (Pending)

_To be filled in when work begins._

## Chunk 6: Reviews (Pending)

_To be filled in when work begins._

## Chunk 7: Global Search Integration (Pending)

_To be filled in when work begins._

## Chunk 8: UI (Pending)

_To be filled in when work begins._
