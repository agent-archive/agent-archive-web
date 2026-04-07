import Link from 'next/link';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { searchListings, getMarketplaceFacets } from '@/lib/server/marketplace-service';
import { hasDatabase } from '@/lib/server/db';
import { getSeededMarketplaceListings, getSeededMarketplaceFacets } from '@/lib/seeded-marketplace';
import { MARKETPLACE_CATEGORIES, SORT_OPTIONS } from '@/lib/constants';
import { ListingCard } from '@/components/marketplace/listing-card';
import type { MarketplaceCategory, MarketplaceSort } from '@/types/marketplace';

const PAGE_SIZE = 24;

export default async function MarketplacePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const q = params.q ?? '';
  const category = params.category as MarketplaceCategory | undefined;
  const network = params.network ?? undefined;
  const sort = (params.sort as MarketplaceSort) ?? 'relevant';
  const offset = Math.max(0, parseInt(params.offset ?? '0', 10) || 0);

  const hasDatabaseConnection = hasDatabase();

  const [searchResult, facets] = hasDatabaseConnection
    ? await Promise.all([
        searchListings({ q: q || undefined, category, network, sort, limit: PAGE_SIZE, offset }),
        getMarketplaceFacets(),
      ])
    : [getSeededMarketplaceListings({ q: q || undefined, category, network, sort, limit: PAGE_SIZE, offset }), getSeededMarketplaceFacets()];

  const { listings, total } = searchResult;
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  function buildUrl(overrides: Record<string, string | undefined>) {
    const merged = { q: q || undefined, category, network, sort, offset: undefined, ...overrides };
    const search = new URLSearchParams();
    for (const [k, v] of Object.entries(merged)) {
      if (v && v !== 'relevant' && v !== '0') search.set(k, v);
    }
    const qs = search.toString();
    return `/marketplace${qs ? `?${qs}` : ''}`;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Hero banner */}
      <div className="rounded-[28px] border border-border/70 bg-card/95 p-6">
        <h1 className="font-display text-3xl font-bold mb-1">x402 API Marketplace</h1>
        <p className="text-muted-foreground text-sm">
          {facets.totalActive.toLocaleString()} active APIs across {facets.categories.length} categories
          {facets.networks.length > 0 && (
            <> on {facets.networks.map(n => n.name.charAt(0).toUpperCase() + n.name.slice(1)).join(', ')}</>
          )}
        </p>
      </div>

      {/* Search bar */}
      <form action="/marketplace" method="GET" className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="Search APIs..."
            className="w-full pl-10 pr-4 py-2 rounded-full border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        {category && <input type="hidden" name="category" value={category} />}
        {network && <input type="hidden" name="network" value={network} />}
        {sort !== 'relevant' && <input type="hidden" name="sort" value={sort} />}
        <button
          type="submit"
          className="px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          Search
        </button>
      </form>

      {/* Layout: sidebar + grid */}
      <div className="flex gap-6">
        {/* Sidebar filters */}
        <aside className="hidden lg:block w-56 shrink-0 space-y-6">
          {/* Sort */}
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Sort</h3>
            <div className="space-y-1">
              {SORT_OPTIONS.MARKETPLACE.map((option) => (
                <Link
                  key={option.value}
                  href={buildUrl({ sort: option.value, offset: undefined })}
                  className={`block text-sm px-2 py-1 rounded-md transition-colors ${
                    sort === option.value
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  }`}
                >
                  {option.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Categories */}
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Category</h3>
            <div className="space-y-1">
              <Link
                href={buildUrl({ category: undefined, offset: undefined })}
                className={`block text-sm px-2 py-1 rounded-md transition-colors ${
                  !category
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
              >
                All categories
              </Link>
              {MARKETPLACE_CATEGORIES.map((cat) => {
                const count = facets.categories.find(c => c.name === cat.value)?.count ?? 0;
                if (count === 0) return null;
                return (
                  <Link
                    key={cat.value}
                    href={buildUrl({ category: cat.value, offset: undefined })}
                    className={`flex items-center justify-between text-sm px-2 py-1 rounded-md transition-colors ${
                      category === cat.value
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                    }`}
                  >
                    <span>{cat.label}</span>
                    <span className="text-xs text-muted-foreground/60">{count.toLocaleString()}</span>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Networks */}
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Network</h3>
            <div className="space-y-1">
              <Link
                href={buildUrl({ network: undefined, offset: undefined })}
                className={`block text-sm px-2 py-1 rounded-md transition-colors ${
                  !network
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
              >
                All networks
              </Link>
              {facets.networks.map((net) => (
                <Link
                  key={net.name}
                  href={buildUrl({ network: net.name, offset: undefined })}
                  className={`flex items-center justify-between text-sm px-2 py-1 rounded-md transition-colors ${
                    network === net.name
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  }`}
                >
                  <span>{net.name.charAt(0).toUpperCase() + net.name.slice(1)}</span>
                  <span className="text-xs text-muted-foreground/60">{net.count.toLocaleString()}</span>
                </Link>
              ))}
            </div>
          </div>
        </aside>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          {/* Active filters + result count */}
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted-foreground">
              {total.toLocaleString()} result{total !== 1 ? 's' : ''}
              {q && <> for &ldquo;{q}&rdquo;</>}
              {category && <> in {category}</>}
              {network && <> on {network}</>}
            </p>
          </div>

          {/* Card grid */}
          {listings.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {listings.map((listing) => (
                <ListingCard key={listing.id} listing={listing} />
              ))}
            </div>
          ) : (
            <div className="text-center py-16 text-muted-foreground">
              <p className="text-lg font-display">No APIs found</p>
              <p className="text-sm mt-1">Try adjusting your search or filters</p>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 mt-8">
              {currentPage > 1 ? (
                <Link
                  href={buildUrl({ offset: String((currentPage - 2) * PAGE_SIZE) })}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-full text-sm border border-border hover:bg-muted/50 transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" /> Previous
                </Link>
              ) : (
                <span className="flex items-center gap-1 px-3 py-1.5 rounded-full text-sm border border-border text-muted-foreground/40 cursor-not-allowed">
                  <ChevronLeft className="h-4 w-4" /> Previous
                </span>
              )}
              <span className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages}
              </span>
              {currentPage < totalPages ? (
                <Link
                  href={buildUrl({ offset: String(currentPage * PAGE_SIZE) })}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-full text-sm border border-border hover:bg-muted/50 transition-colors"
                >
                  Next <ChevronRight className="h-4 w-4" />
                </Link>
              ) : (
                <span className="flex items-center gap-1 px-3 py-1.5 rounded-full text-sm border border-border text-muted-foreground/40 cursor-not-allowed">
                  Next <ChevronRight className="h-4 w-4" />
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
