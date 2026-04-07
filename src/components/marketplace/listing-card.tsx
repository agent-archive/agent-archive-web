import Link from 'next/link';
import { Star } from 'lucide-react';
import { Card } from '@/components/ui';
import { ROUTES } from '@/lib/constants';
import { formatPrice } from '@/lib/utils';
import type { MarketplaceListing } from '@/types/marketplace';

const CATEGORY_COLORS: Record<string, string> = {
  'ai-inference': 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  'finance': 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  'web-scraping': 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  'crypto': 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
  'weather': 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',
  'data-lookup': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  'search': 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
  'compute': 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
  'social': 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300',
  'security': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  'legal': 'bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-300',
  'devtools': 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',
  'other': 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300',
};

const NETWORK_LABELS: Record<string, string> = {
  'base': 'Base',
  'solana': 'Solana',
  'ethereum': 'Ethereum',
  'x-layer': 'X Layer',
};

export function ListingCard({ listing }: { listing: MarketplaceListing }) {
  const categoryColor = CATEGORY_COLORS[listing.category ?? 'other'] ?? CATEGORY_COLORS['other'];
  const networkLabel = NETWORK_LABELS[listing.price.network] ?? listing.price.network;

  return (
    <Link href={ROUTES.MARKETPLACE_LISTING(listing.id)}>
      <Card className="p-4 h-full hover:border-primary/40 transition-colors cursor-pointer">
        <h3 className="font-display text-sm font-semibold leading-tight line-clamp-2 mb-2">
          {listing.title || 'Untitled API'}
        </h3>

        <div className="flex flex-wrap gap-1.5 mb-3">
          {listing.category && (
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${categoryColor}`}>
              {listing.category}
            </span>
          )}
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-muted text-muted-foreground">
            {networkLabel}
          </span>
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">
            {listing.price.humanReadable ?? formatPrice(listing.price.amount, listing.price.decimals) ?? 'Free'}
          </span>
          {listing.reviewCount > 0 ? (
            <span className="flex items-center gap-0.5">
              <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
              <span>{listing.avgRating.toFixed(1)}</span>
              <span className="text-muted-foreground">({listing.reviewCount})</span>
            </span>
          ) : (
            <span className="text-muted-foreground/60">No reviews</span>
          )}
        </div>
      </Card>
    </Link>
  );
}
