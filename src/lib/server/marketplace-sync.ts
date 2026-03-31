import { createHash } from 'crypto';
import { query } from '@/lib/server/db';

// ────────────────────────────────────────────────────────────
// Raw API response types (internal only)
// ────────────────────────────────────────────────────────────

interface FacilitatorAccept {
  asset?: string;
  description?: string;
  extra?: { name?: string; version?: string; description?: string; feePayer?: string; mimeType?: string };
  maxAmountRequired?: string;
  amount?: string;
  maxTimeoutSeconds?: number;
  network?: string;
  outputSchema?: {
    input?: Record<string, unknown>;
    output?: Record<string, unknown>;
  };
  payTo?: string;
  scheme?: string;
  mimeType?: string;
  resource?: string;
}

interface FacilitatorItem {
  resource: string;
  type?: string;
  x402Version?: number;
  lastUpdated?: string;
  method?: string;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  accepts?: FacilitatorAccept[];
}

interface FacilitatorPage {
  resources?: FacilitatorItem[];
  items?: FacilitatorItem[];
  total?: number;
  limit?: number;
  offset?: number;
}

// ────────────────────────────────────────────────────────────
// Normalized row for upsert
// ────────────────────────────────────────────────────────────

interface NormalizedListing {
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
  is_testnet: boolean;
  facilitator_name: string;
}

export interface SyncStats {
  inserted: number;
  updated: number;
  staleMarked: number;
  totalProcessed: number;
  errors: string[];
  facilitatorStats: Record<string, { pages: number; items: number; errors: number }>;
}

// ────────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────────

const FACILITATORS = {
  coinbase: {
    name: 'coinbase',
    baseUrl: 'https://api.cdp.coinbase.com/platform/v2/x402/discovery/resources',
  },
  payai: {
    name: 'payai',
    baseUrl: 'https://facilitator.payai.network/discovery/resources',
  },
} as const;

const PAGE_SIZE = 100;
const STALE_DAYS = 7;

const NETWORK_MAP: Record<string, string> = {
  'base': 'base',
  'eip155:8453': 'base',
  'base-sepolia': 'base-sepolia',
  'solana': 'solana',
  'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp': 'solana',
  'eip155:1': 'ethereum',
  'eip155:196': 'x-layer',
};

const TESTNET_PATTERNS = ['sepolia', 'testnet', 'devnet'];

// ────────────────────────────────────────────────────────────
// Helper functions
// ────────────────────────────────────────────────────────────

function hashUrl(url: string): string {
  return createHash('sha256').update(url).digest('hex');
}

function normalizeNetwork(raw: string | undefined): { network: string; isTestnet: boolean } {
  if (!raw) return { network: 'unknown', isTestnet: false };

  const lower = raw.toLowerCase();
  const network = NETWORK_MAP[lower] ?? NETWORK_MAP[raw] ?? 'unknown';
  const isTestnet = TESTNET_PATTERNS.some((p) => lower.includes(p));

  return { network, isTestnet };
}

function humanizePrice(amount: string | undefined, decimals: number): string | null {
  if (!amount) return null;
  try {
    const value = Number(amount) / Math.pow(10, decimals);
    if (isNaN(value)) return null;
    return `$${value.toFixed(2)}`;
  } catch {
    return null;
  }
}

// ────────────────────────────────────────────────────────────
// Normalizers (one per facilitator)
// ────────────────────────────────────────────────────────────

function normalizeCoinbaseListing(item: FacilitatorItem): NormalizedListing {
  const accept = item.accepts?.[0];
  const inputObj = accept?.outputSchema?.input as Record<string, unknown> | undefined;
  const outputObj = accept?.outputSchema?.output as Record<string, unknown> | undefined;
  const { network, isTestnet } = normalizeNetwork(accept?.network);
  const itemType = item.type || 'http';

  return {
    resource_url: item.resource,
    url_hash: hashUrl(item.resource),
    type: itemType,
    x402_version: item.x402Version ?? 1,
    http_method: (inputObj?.method as string) ?? null,
    mcp_tool_name: itemType === 'mcp' ? (inputObj?.tool as string) ?? null : null,
    raw_description: accept?.description ?? null,
    input_schema: inputObj ?? null,
    output_schema: outputObj ?? null,
    price_amount: accept?.maxAmountRequired ?? null,
    price_asset: accept?.asset ?? null,
    price_token_name: accept?.extra?.name ?? null,
    price_network: network,
    price_network_raw: accept?.network ?? null,
    price_human_readable: humanizePrice(accept?.maxAmountRequired, 6),
    price_decimals: 6,
    pay_to: accept?.payTo ?? null,
    max_timeout_seconds: accept?.maxTimeoutSeconds ?? null,
    is_testnet: isTestnet,
    facilitator_name: 'coinbase',
  };
}

function normalizePayAIListing(item: FacilitatorItem): NormalizedListing {
  const accept = item.accepts?.[0];
  const { network, isTestnet } = normalizeNetwork(accept?.network);
  const rawDescription = accept?.description || accept?.extra?.description || null;
  const itemType = item.type || 'http';

  return {
    resource_url: item.resource,
    url_hash: hashUrl(item.resource),
    type: itemType,
    x402_version: item.x402Version ?? 1,
    http_method: item.method ?? null,
    mcp_tool_name: itemType === 'mcp' ? (item.method ?? null) : null,
    raw_description: rawDescription,
    input_schema: item.inputSchema ?? null,
    output_schema: item.outputSchema ?? null,
    price_amount: accept?.amount ?? null,
    price_asset: accept?.asset ?? null,
    price_token_name: accept?.extra?.name ?? null,
    price_network: network,
    price_network_raw: accept?.network ?? null,
    price_human_readable: humanizePrice(accept?.amount, 6),
    price_decimals: 6,
    pay_to: accept?.payTo ?? null,
    max_timeout_seconds: accept?.maxTimeoutSeconds ?? null,
    is_testnet: isTestnet,
    facilitator_name: 'payai',
  };
}

// ────────────────────────────────────────────────────────────
// Fetch
// ────────────────────────────────────────────────────────────

async function fetchFacilitatorPage(baseUrl: string, limit: number, offset: number): Promise<FacilitatorPage> {
  const url = `${baseUrl}?limit=${limit}&offset=${offset}`;
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Facilitator fetch failed: ${response.status} ${response.statusText} (${url})`);
  }
  return response.json();
}

// ────────────────────────────────────────────────────────────
// Database operations
// ────────────────────────────────────────────────────────────

const COLS_PER_ROW = 20;

async function upsertListingsBatch(listings: NormalizedListing[]): Promise<{ inserted: number; updated: number }> {
  if (listings.length === 0) return { inserted: 0, updated: 0 };

  const values: unknown[] = [];
  const valuesClauses: string[] = [];

  for (let i = 0; i < listings.length; i++) {
    const base = i * COLS_PER_ROW;
    const placeholders: string[] = [];
    for (let j = 0; j < COLS_PER_ROW; j++) {
      const idx = `$${base + j + 1}`;
      // Cast JSONB columns: input_schema (8), output_schema (9), facilitators (20)
      if (j === 7 || j === 8 || j === 19) {
        placeholders.push(`${idx}::jsonb`);
      } else {
        placeholders.push(idx);
      }
    }
    valuesClauses.push(`(${placeholders.join(', ')}, NOW())`);

    const l = listings[i];
    const facilitatorJson = JSON.stringify([
      { name: l.facilitator_name, lastSeen: new Date().toISOString() },
    ]);

    values.push(
      l.resource_url,
      l.url_hash,
      l.type,
      l.x402_version,
      l.http_method,
      l.mcp_tool_name,
      l.raw_description,
      l.input_schema ? JSON.stringify(l.input_schema) : null,
      l.output_schema ? JSON.stringify(l.output_schema) : null,
      l.price_amount,
      l.price_asset,
      l.price_token_name,
      l.price_network,
      l.price_network_raw,
      l.price_human_readable,
      l.price_decimals,
      l.pay_to,
      l.max_timeout_seconds,
      l.is_testnet,
      facilitatorJson,
    );
  }

  const sql = `
    INSERT INTO x402_listings (
      resource_url, url_hash, type, x402_version, http_method, mcp_tool_name,
      raw_description, input_schema, output_schema,
      price_amount, price_asset, price_token_name, price_network, price_network_raw,
      price_human_readable, price_decimals, pay_to, max_timeout_seconds,
      is_testnet, facilitators, last_seen_at
    )
    VALUES ${valuesClauses.join(',\n      ')}
    ON CONFLICT (url_hash) DO UPDATE SET
      resource_url = EXCLUDED.resource_url,
      type = EXCLUDED.type,
      x402_version = EXCLUDED.x402_version,
      http_method = COALESCE(EXCLUDED.http_method, x402_listings.http_method),
      mcp_tool_name = COALESCE(EXCLUDED.mcp_tool_name, x402_listings.mcp_tool_name),
      raw_description = COALESCE(EXCLUDED.raw_description, x402_listings.raw_description),
      input_schema = COALESCE(EXCLUDED.input_schema, x402_listings.input_schema),
      output_schema = COALESCE(EXCLUDED.output_schema, x402_listings.output_schema),
      price_amount = EXCLUDED.price_amount,
      price_asset = EXCLUDED.price_asset,
      price_token_name = COALESCE(EXCLUDED.price_token_name, x402_listings.price_token_name),
      price_network = EXCLUDED.price_network,
      price_network_raw = EXCLUDED.price_network_raw,
      price_human_readable = EXCLUDED.price_human_readable,
      price_decimals = EXCLUDED.price_decimals,
      pay_to = EXCLUDED.pay_to,
      max_timeout_seconds = EXCLUDED.max_timeout_seconds,
      is_testnet = EXCLUDED.is_testnet,
      facilitators = (
        SELECT jsonb_agg(val)
        FROM (
          SELECT DISTINCT ON (val->>'name') val
          FROM jsonb_array_elements(
            COALESCE(x402_listings.facilitators, '[]'::jsonb) || EXCLUDED.facilitators
          ) AS val
          ORDER BY val->>'name', val->>'lastSeen' DESC
        ) sub
      ),
      last_seen_at = NOW()
    RETURNING (xmax = 0) AS was_inserted
  `;

  const result = await query<{ was_inserted: boolean }>(sql, values);
  const inserted = result.rows.filter((r) => r.was_inserted).length;
  const updated = result.rows.filter((r) => !r.was_inserted).length;

  return { inserted, updated };
}

async function markStaleListings(): Promise<number> {
  const result = await query(
    `UPDATE x402_listings
     SET is_stale = true
     WHERE last_seen_at < NOW() - INTERVAL '${STALE_DAYS} days'
       AND is_stale = false`,
  );
  return result.rowCount ?? 0;
}

// ────────────────────────────────────────────────────────────
// Per-facilitator orchestrator
// ────────────────────────────────────────────────────────────

async function fetchAndProcessFacilitator(
  facilitatorKey: keyof typeof FACILITATORS,
  stats: SyncStats,
): Promise<void> {
  const config = FACILITATORS[facilitatorKey];
  const normalize = facilitatorKey === 'coinbase' ? normalizeCoinbaseListing : normalizePayAIListing;
  const facStats = { pages: 0, items: 0, errors: 0 };
  stats.facilitatorStats[config.name] = facStats;

  let offset = 0;

  while (true) {
    let page: FacilitatorPage;
    try {
      page = await fetchFacilitatorPage(config.baseUrl, PAGE_SIZE, offset);
    } catch (err) {
      const msg = `[${config.name}] Page fetch failed at offset ${offset}: ${err instanceof Error ? err.message : err}`;
      console.error(msg);
      stats.errors.push(msg);
      facStats.errors++;
      break;
    }

    facStats.pages++;
    const items = page.resources ?? page.items ?? [];
    if (items.length === 0) break;

    const normalized: NormalizedListing[] = [];
    for (const item of items) {
      try {
        if (!item.resource) continue;
        normalized.push(normalize(item));
      } catch (err) {
        const msg = `[${config.name}] Normalize failed for ${item.resource}: ${err instanceof Error ? err.message : err}`;
        console.error(msg);
        stats.errors.push(msg);
        facStats.errors++;
      }
    }

    if (normalized.length > 0) {
      try {
        const result = await upsertListingsBatch(normalized);
        stats.inserted += result.inserted;
        stats.updated += result.updated;
        stats.totalProcessed += normalized.length;
        facStats.items += normalized.length;
      } catch (err) {
        const msg = `[${config.name}] Upsert failed at offset ${offset}: ${err instanceof Error ? err.message : err}`;
        console.error(msg);
        stats.errors.push(msg);
        facStats.errors++;
      }
    }

    if (items.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
}

// ────────────────────────────────────────────────────────────
// Top-level orchestrator (exported)
// ────────────────────────────────────────────────────────────

export async function syncMarketplace(): Promise<SyncStats> {
  const stats: SyncStats = {
    inserted: 0,
    updated: 0,
    staleMarked: 0,
    totalProcessed: 0,
    errors: [],
    facilitatorStats: {},
  };

  console.log('[marketplace-sync] Starting sync...');
  const start = Date.now();

  await Promise.all([
    fetchAndProcessFacilitator('coinbase', stats),
    fetchAndProcessFacilitator('payai', stats),
  ]);

  stats.staleMarked = await markStaleListings();

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(
    `[marketplace-sync] Complete in ${elapsed}s: ${stats.inserted} inserted, ${stats.updated} updated, ${stats.staleMarked} stale marked, ${stats.errors.length} errors`,
  );

  return stats;
}
