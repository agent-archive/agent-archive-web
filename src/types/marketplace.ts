// x402 Marketplace Types

export type MarketplaceCategory =
  | 'ai-inference'
  | 'finance'
  | 'web-scraping'
  | 'crypto'
  | 'weather'
  | 'data-lookup'
  | 'search'
  | 'compute'
  | 'social'
  | 'security'
  | 'legal'
  | 'devtools'
  | 'other';

export type MarketplaceListingType = 'http' | 'mcp';
export type MarketplaceSort = 'relevant' | 'rating' | 'price_asc' | 'price_desc' | 'recent';
export type MarketplaceReviewSort = 'recent' | 'top';

export interface MarketplaceFacilitator {
  name: string;
  lastSeen: string;
}

export interface MarketplaceListingPrice {
  amount: string;
  asset?: string;
  tokenName?: string;
  network: string;
  networkRaw?: string;
  humanReadable?: string;
  decimals: number;
}

export interface MarketplaceListing {
  id: string;
  resourceUrl: string;
  type: MarketplaceListingType;
  x402Version: number;
  httpMethod?: string;
  mcpToolName?: string;
  title?: string;
  description?: string;
  rawDescription?: string;
  category?: MarketplaceCategory;
  tags: string[];
  descriptionConfidence: number;
  enrichmentSource?: string;
  enrichedAt?: string;
  price: MarketplaceListingPrice;
  payTo?: string;
  maxTimeoutSeconds?: number;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  facilitators: MarketplaceFacilitator[];
  avgRating: number;
  reviewCount: number;
  isVerified: boolean;
  isStale: boolean;
  isTestnet: boolean;
  firstSeenAt: string;
  lastSeenAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface MarketplaceReview {
  id: string;
  listingId: string;
  authorId: string;
  overallRating: number;
  reliability?: number;
  accuracy?: number;
  value?: number;
  latency?: number;
  documentation?: number;
  content?: string;
  useCase?: string;
  isFlagged: boolean;
  flagReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MarketplaceFacetItem {
  name: string;
  count: number;
}

export interface MarketplaceFacets {
  categories: MarketplaceFacetItem[];
  networks: MarketplaceFacetItem[];
  types: MarketplaceFacetItem[];
  totalListings: number;
  totalActive: number;
}

export interface MarketplaceSearchParams {
  q?: string;
  category?: MarketplaceCategory;
  type?: MarketplaceListingType;
  network?: string;
  minRating?: number;
  maxPrice?: string;
  sort?: MarketplaceSort;
  limit?: number;
  offset?: number;
}
