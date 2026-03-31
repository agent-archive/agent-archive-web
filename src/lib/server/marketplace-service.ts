import { query } from '@/lib/server/db';
import type { MarketplaceListing, MarketplaceFacets, MarketplaceSearchParams } from '@/types/marketplace';

// ────────────────────────────────────────────────────────────
// Row type (internal, matches DB columns)
// ────────────────────────────────────────────────────────────

interface ListingRow {
  id: string;
  resource_url: string;
  url_hash: string;
  type: string;
  x402_version: number;
  http_method: string | null;
  mcp_tool_name: string | null;
  raw_description: string | null;
  input_schema: Record<string, unknown> | null;
  output_schema: Record<string, unknown> | null;
  price_amount: string | null;
  price_asset: string | null;
  price_token_name: string | null;
  price_network: string;
  price_network_raw: string | null;
  price_human_readable: string | null;
  price_decimals: number;
  pay_to: string | null;
  max_timeout_seconds: number | null;
  facilitators: unknown[];
  enriched_title: string | null;
  enriched_description: string | null;
  enriched_category: string | null;
  enriched_tags: string[] | null;
  description_confidence: number;
  enrichment_source: string | null;
  enriched_at: string | null;
  avg_rating: number;
  review_count: number;
  is_verified: boolean;
  is_stale: boolean;
  is_testnet: boolean;
  first_seen_at: string;
  last_seen_at: string;
  created_at: string;
  updated_at: string;
  search_rank?: number;
}

// ────────────────────────────────────────────────────────────
// Row mapper
// ────────────────────────────────────────────────────────────

function mapListingRow(row: ListingRow): MarketplaceListing {
  return {
    id: row.id,
    resourceUrl: row.resource_url,
    type: row.type as MarketplaceListing['type'],
    x402Version: row.x402_version,
    httpMethod: row.http_method ?? undefined,
    mcpToolName: row.mcp_tool_name ?? undefined,
    title: row.enriched_title ?? undefined,
    description: row.enriched_description ?? undefined,
    rawDescription: row.raw_description ?? undefined,
    category: row.enriched_category as MarketplaceListing['category'],
    tags: row.enriched_tags ?? [],
    descriptionConfidence: row.description_confidence,
    enrichmentSource: row.enrichment_source ?? undefined,
    enrichedAt: row.enriched_at ?? undefined,
    price: {
      amount: row.price_amount ?? '0',
      asset: row.price_asset ?? undefined,
      tokenName: row.price_token_name ?? undefined,
      network: row.price_network,
      networkRaw: row.price_network_raw ?? undefined,
      humanReadable: row.price_human_readable ?? undefined,
      decimals: row.price_decimals,
    },
    payTo: row.pay_to ?? undefined,
    maxTimeoutSeconds: row.max_timeout_seconds ?? undefined,
    inputSchema: row.input_schema ?? undefined,
    outputSchema: row.output_schema ?? undefined,
    facilitators: (row.facilitators ?? []) as MarketplaceListing['facilitators'],
    avgRating: row.avg_rating,
    reviewCount: row.review_count,
    isVerified: row.is_verified,
    isStale: row.is_stale,
    isTestnet: row.is_testnet,
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ────────────────────────────────────────────────────────────
// Search listings
// ────────────────────────────────────────────────────────────

export async function searchListings(
  params: MarketplaceSearchParams,
): Promise<{ listings: MarketplaceListing[]; total: number }> {
  const limit = Math.min(params.limit ?? 25, 100);
  const offset = params.offset ?? 0;
  const hasQuery = params.q && params.q.trim().length > 0;

  const conditions: string[] = ['is_stale = false', 'is_testnet = false'];
  const values: unknown[] = [];
  let paramIdx = 0;

  // Full-text search
  let rankExpression = 'description_confidence';
  if (hasQuery) {
    paramIdx++;
    conditions.push(`search_vector @@ plainto_tsquery('english', $${paramIdx})`);
    values.push(params.q!.trim());
    rankExpression = `ts_rank(search_vector, plainto_tsquery('english', $1)) * (1.0 + description_confidence)`;
  }

  // Category filter
  if (params.category) {
    paramIdx++;
    conditions.push(`enriched_category = $${paramIdx}`);
    values.push(params.category);
  }

  // Type filter
  if (params.type) {
    paramIdx++;
    conditions.push(`type = $${paramIdx}`);
    values.push(params.type);
  }

  // Network filter
  if (params.network) {
    paramIdx++;
    conditions.push(`price_network = $${paramIdx}`);
    values.push(params.network);
  }

  // Min rating filter
  if (params.minRating !== undefined) {
    paramIdx++;
    conditions.push(`avg_rating >= $${paramIdx}`);
    values.push(params.minRating);
  }

  // Max price filter (human-readable dollars)
  if (params.maxPrice) {
    paramIdx++;
    conditions.push(`price_amount IS NOT NULL AND (price_amount::numeric / power(10, price_decimals)) <= $${paramIdx}`);
    values.push(parseFloat(params.maxPrice));
  }

  const whereClause = conditions.join(' AND ');

  // Sort
  let orderClause: string;
  switch (params.sort) {
    case 'rating':
      orderClause = 'avg_rating DESC, review_count DESC, description_confidence DESC';
      break;
    case 'price_asc':
      orderClause = 'CASE WHEN price_amount IS NOT NULL THEN price_amount::numeric / power(10, price_decimals) ELSE 999999 END ASC, description_confidence DESC';
      break;
    case 'price_desc':
      orderClause = 'CASE WHEN price_amount IS NOT NULL THEN price_amount::numeric / power(10, price_decimals) ELSE 0 END DESC, description_confidence DESC';
      break;
    case 'recent':
      orderClause = 'last_seen_at DESC, description_confidence DESC';
      break;
    default: // 'relevant'
      orderClause = `${rankExpression} DESC, description_confidence DESC`;
      break;
  }

  // Count query
  const countValues = [...values];
  const countResult = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM x402_listings WHERE ${whereClause}`,
    countValues,
  );
  const total = parseInt(countResult.rows[0]?.count ?? '0', 10);

  // Data query
  paramIdx++;
  values.push(limit);
  const limitRef = paramIdx;

  paramIdx++;
  values.push(offset);
  const offsetRef = paramIdx;

  const result = await query<ListingRow>(
    `SELECT *, ${rankExpression} AS search_rank
     FROM x402_listings
     WHERE ${whereClause}
     ORDER BY ${orderClause}
     LIMIT $${limitRef} OFFSET $${offsetRef}`,
    values,
  );

  return {
    listings: result.rows.map(mapListingRow),
    total,
  };
}

// ────────────────────────────────────────────────────────────
// Get single listing
// ────────────────────────────────────────────────────────────

export async function getListingById(id: string): Promise<MarketplaceListing | null> {
  const result = await query<ListingRow>(
    `SELECT * FROM x402_listings WHERE id = $1`,
    [id],
  );

  if (result.rows.length === 0) return null;
  return mapListingRow(result.rows[0]);
}

// ────────────────────────────────────────────────────────────
// Facets
// ────────────────────────────────────────────────────────────

export async function getMarketplaceFacets(): Promise<MarketplaceFacets> {
  const [categories, networks, types, totals] = await Promise.all([
    query<{ name: string; count: number }>(
      `SELECT enriched_category AS name, COUNT(*)::int AS count
       FROM x402_listings
       WHERE is_stale = false AND is_testnet = false AND enriched_category IS NOT NULL
       GROUP BY enriched_category ORDER BY count DESC`,
    ),
    query<{ name: string; count: number }>(
      `SELECT price_network AS name, COUNT(*)::int AS count
       FROM x402_listings
       WHERE is_stale = false AND is_testnet = false
       GROUP BY price_network ORDER BY count DESC`,
    ),
    query<{ name: string; count: number }>(
      `SELECT type AS name, COUNT(*)::int AS count
       FROM x402_listings
       WHERE is_stale = false AND is_testnet = false
       GROUP BY type ORDER BY count DESC`,
    ),
    query<{ total: string; active: string }>(
      `SELECT
         COUNT(*)::text AS total,
         COUNT(*) FILTER (WHERE is_stale = false AND is_testnet = false)::text AS active
       FROM x402_listings`,
    ),
  ]);

  return {
    categories: categories.rows,
    networks: networks.rows,
    types: types.rows,
    totalListings: parseInt(totals.rows[0]?.total ?? '0', 10),
    totalActive: parseInt(totals.rows[0]?.active ?? '0', 10),
  };
}

// ────────────────────────────────────────────────────────────
// Global search helper (for Chunk 7)
// ────────────────────────────────────────────────────────────

export async function searchListingsForGlobal(
  q: string,
  limit = 5,
): Promise<MarketplaceListing[]> {
  const result = await query<ListingRow>(
    `SELECT *, ts_rank(search_vector, plainto_tsquery('english', $1)) * (1.0 + description_confidence) AS search_rank
     FROM x402_listings
     WHERE is_stale = false AND is_testnet = false
       AND description_confidence >= 0.5
       AND search_vector @@ plainto_tsquery('english', $1)
     ORDER BY search_rank DESC
     LIMIT $2`,
    [q.trim(), limit],
  );

  return result.rows.map(mapListingRow);
}
