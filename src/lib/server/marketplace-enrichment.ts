import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import * as z from 'zod';
import { query } from '@/lib/server/db';

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

interface ListingRow {
  id: string;
  resource_url: string;
  type: string;
  http_method: string | null;
  mcp_tool_name: string | null;
  raw_description: string | null;
  input_schema: Record<string, unknown> | null;
  output_schema: Record<string, unknown> | null;
  price_amount: string | null;
  price_token_name: string | null;
  price_network: string;
}

interface EnrichmentResult {
  title: string;
  description: string;
  category: string;
  tags: string[];
  confidence: number;
  source: 'raw' | 'llm';
}

export interface EnrichStats {
  total: number;
  tier1: number;
  tier2: number;
  embedded: number;
  failed: number;
  errors: string[];
  durationMs: number;
}

// ────────────────────────────────────────────────────────────
// Zod schema for LLM response validation
// ────────────────────────────────────────────────────────────

const VALID_CATEGORIES = [
  'ai-inference', 'finance', 'web-scraping', 'crypto', 'weather',
  'data-lookup', 'search', 'compute', 'social', 'security',
  'legal', 'devtools', 'other',
] as const;

const enrichmentResponseSchema = z.object({
  title: z.string().max(80),
  description: z.string().max(200),
  category: z.enum(VALID_CATEGORIES),
  tags: z.array(z.string()).max(5),
  confidence: z.number().min(0).max(1),
});

// ────────────────────────────────────────────────────────────
// Concurrency limiter
// ────────────────────────────────────────────────────────────

function createLimiter(max: number) {
  let active = 0;
  const queue: Array<() => void> = [];

  return async function limit<T>(fn: () => Promise<T>): Promise<T> {
    if (active >= max) {
      await new Promise<void>((resolve) => queue.push(resolve));
    }
    active++;
    try {
      return await fn();
    } finally {
      active--;
      queue.shift()?.();
    }
  };
}

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

function getTier(listing: ListingRow): 1 | 2 {
  return listing.raw_description && listing.raw_description.length > 40 ? 1 : 2;
}

function truncateSchema(schema: Record<string, unknown> | null, maxChars: number): string {
  if (!schema) return 'N/A';
  const str = JSON.stringify(schema);
  if (str.length <= maxChars) return str;
  return str.slice(0, maxChars) + '...';
}

function buildPrompt(listing: ListingRow): string {
  return `You are enriching an x402 API listing for a marketplace. Given the following information about an API endpoint, generate a structured enrichment.

URL: ${listing.resource_url}
Type: ${listing.type}
HTTP Method: ${listing.http_method || 'N/A'}
MCP Tool: ${listing.mcp_tool_name || 'N/A'}
Raw Description: ${listing.raw_description || 'N/A'}
Input Schema: ${truncateSchema(listing.input_schema, 500)}
Output Schema: ${truncateSchema(listing.output_schema, 500)}
Price: ${listing.price_amount || 'N/A'} ${listing.price_token_name || ''} on ${listing.price_network}

Respond with JSON only, no other text:
{
  "title": "Short human-readable name (max 80 chars)",
  "description": "What this API does, in 1-2 sentences (max 200 chars)",
  "category": "one of: ai-inference, finance, web-scraping, crypto, weather, data-lookup, search, compute, social, security, legal, devtools, other",
  "tags": ["up to 5 relevant tags"],
  "confidence": 0.0-1.0
}`;
}

function parseEnrichmentResponse(raw: string): z.infer<typeof enrichmentResponseSchema> | null {
  try {
    // Extract JSON from response (handle markdown code blocks)
    let jsonStr = raw.trim();
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (jsonMatch) jsonStr = jsonMatch[0];

    const parsed = JSON.parse(jsonStr);
    const validated = enrichmentResponseSchema.parse(parsed);
    return validated;
  } catch {
    return null;
  }
}

// ────────────────────────────────────────────────────────────
// LLM enrichment (single listing)
// ────────────────────────────────────────────────────────────

async function enrichSingleListing(
  anthropic: Anthropic,
  listing: ListingRow,
): Promise<EnrichmentResult> {
  const tier = getTier(listing);
  const prompt = buildPrompt(listing);

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 256,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  const parsed = parseEnrichmentResponse(text);

  if (!parsed) {
    // Fallback: derive title from URL
    const urlPath = new URL(listing.resource_url).pathname;
    const titleFromUrl = urlPath.split('/').filter(Boolean).slice(-2).join(' / ') || 'Unknown API';
    return {
      title: titleFromUrl.slice(0, 80),
      description: listing.raw_description?.slice(0, 200) || '',
      category: 'other',
      tags: [],
      confidence: 0.1,
      source: tier === 1 ? 'raw' : 'llm',
    };
  }

  if (tier === 1) {
    return {
      title: parsed.title,
      description: listing.raw_description!.slice(0, 200),
      category: parsed.category,
      tags: parsed.tags,
      confidence: Math.max(parsed.confidence, 0.8),
      source: 'raw',
    };
  }

  return {
    title: parsed.title,
    description: parsed.description,
    category: parsed.category,
    tags: parsed.tags,
    confidence: Math.min(Math.max(parsed.confidence, 0.3), 0.6),
    source: 'llm',
  };
}

// ────────────────────────────────────────────────────────────
// Embedding generation
// ────────────────────────────────────────────────────────────

interface EmbeddingRow {
  id: string;
  enriched_title: string | null;
  enriched_description: string | null;
  enriched_category: string | null;
  enriched_tags: string[] | null;
}

async function generateEmbeddings(batchSize = 2048): Promise<number> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn('[marketplace-enrich] OPENAI_API_KEY not set, skipping embeddings');
    return 0;
  }

  const openai = new OpenAI({ apiKey });

  const { rows } = await query<EmbeddingRow>(
    `SELECT id, enriched_title, enriched_description, enriched_category, enriched_tags
     FROM x402_listings
     WHERE enriched_at IS NOT NULL AND embedding IS NULL
     ORDER BY enriched_at DESC`,
  );

  if (rows.length === 0) return 0;

  let embedded = 0;

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const inputs = batch.map((r) =>
      [r.enriched_title, r.enriched_description, r.enriched_category, (r.enriched_tags || []).join(' ')]
        .filter(Boolean)
        .join(' '),
    );

    const resp = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: inputs,
    });

    // Batch update embeddings
    const values: unknown[] = [];
    const valueClauses: string[] = [];
    for (let j = 0; j < batch.length; j++) {
      const idx = j * 2;
      valueClauses.push(`($${idx + 1}::uuid, $${idx + 2}::vector)`);
      values.push(batch[j].id, JSON.stringify(resp.data[j].embedding));
    }

    await query(
      `UPDATE x402_listings SET embedding = v.emb
       FROM (VALUES ${valueClauses.join(', ')}) AS v(id, emb)
       WHERE x402_listings.id = v.id`,
      values,
    );

    embedded += batch.length;
    console.log(`[marketplace-enrich] Embedded ${embedded}/${rows.length}`);
  }

  return embedded;
}

// ────────────────────────────────────────────────────────────
// Top-level orchestrator
// ────────────────────────────────────────────────────────────

export async function enrichMarketplace(options?: {
  batchSize?: number;
  concurrency?: number;
  limit?: number;
}): Promise<EnrichStats> {
  const batchSize = options?.batchSize ?? 50;
  const concurrency = options?.concurrency ?? 20;
  const limit = options?.limit ?? 100000;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not configured');
  }

  const anthropic = new Anthropic({ apiKey });

  const stats: EnrichStats = {
    total: 0,
    tier1: 0,
    tier2: 0,
    embedded: 0,
    failed: 0,
    errors: [],
    durationMs: 0,
  };

  const start = Date.now();
  console.log(`[marketplace-enrich] Starting enrichment (batch=${batchSize}, concurrency=${concurrency}, limit=${limit})`);

  // Fetch unenriched listings, Tier 1 first
  const { rows: listings } = await query<ListingRow>(
    `SELECT id, resource_url, type, http_method, mcp_tool_name,
            raw_description, input_schema, output_schema,
            price_amount, price_token_name, price_network
     FROM x402_listings
     WHERE enriched_at IS NULL AND is_stale = false
     ORDER BY
       CASE WHEN raw_description IS NOT NULL AND char_length(raw_description) > 40 THEN 0 ELSE 1 END,
       last_seen_at DESC
     LIMIT $1`,
    [limit],
  );

  console.log(`[marketplace-enrich] Found ${listings.length} listings to enrich`);

  const limiter = createLimiter(concurrency);

  // Process in batches
  for (let i = 0; i < listings.length; i += batchSize) {
    const batch = listings.slice(i, i + batchSize);

    const results = await Promise.all(
      batch.map((listing) =>
        limiter(async () => {
          try {
            const result = await enrichSingleListing(anthropic, listing);
            return { listing, result, error: null };
          } catch (err) {
            return { listing, result: null, error: err };
          }
        }),
      ),
    );

    // Batch update DB
    for (const { listing, result, error } of results) {
      if (error || !result) {
        stats.failed++;
        const msg = `Failed to enrich ${listing.resource_url}: ${error instanceof Error ? error.message : error}`;
        console.error(`[marketplace-enrich] ${msg}`);
        if (stats.errors.length < 100) stats.errors.push(msg);
        continue;
      }

      try {
        await query(
          `UPDATE x402_listings SET
            enriched_title = $2,
            enriched_description = $3,
            enriched_category = $4,
            enriched_tags = $5,
            description_confidence = $6,
            enrichment_source = $7,
            enriched_at = NOW()
          WHERE id = $1`,
          [
            listing.id,
            result.title,
            result.description,
            result.category,
            result.tags,
            result.confidence,
            result.source,
          ],
        );

        stats.total++;
        if (getTier(listing) === 1) stats.tier1++;
        else stats.tier2++;
      } catch (err) {
        stats.failed++;
        const msg = `DB update failed for ${listing.id}: ${err instanceof Error ? err.message : err}`;
        console.error(`[marketplace-enrich] ${msg}`);
        if (stats.errors.length < 100) stats.errors.push(msg);
      }
    }

    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(
      `[marketplace-enrich] Progress: ${Math.min(i + batchSize, listings.length)}/${listings.length} (${elapsed}s, tier1=${stats.tier1}, tier2=${stats.tier2}, failed=${stats.failed})`,
    );
  }

  // Phase 2: Generate embeddings
  console.log('[marketplace-enrich] Generating embeddings...');
  stats.embedded = await generateEmbeddings();

  stats.durationMs = Date.now() - start;
  const elapsed = (stats.durationMs / 1000).toFixed(1);
  console.log(
    `[marketplace-enrich] Complete in ${elapsed}s: ${stats.total} enriched (${stats.tier1} tier1, ${stats.tier2} tier2), ${stats.embedded} embedded, ${stats.failed} failed`,
  );

  return stats;
}
