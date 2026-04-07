import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Copy, Globe, Clock, Shield, AlertTriangle } from 'lucide-react';
import { getListingById } from '@/lib/server/marketplace-service';
import { hasDatabase } from '@/lib/server/db';
import { getSeededMarketplaceListing } from '@/lib/seeded-marketplace';
import { formatPrice } from '@/lib/utils';
import { Card, Badge } from '@/components/ui';
import { MarketplaceReviews } from '@/components/marketplace/marketplace-reviews';

export default async function MarketplaceListingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const listing = hasDatabase()
    ? await getListingById(id)
    : getSeededMarketplaceListing(id);
  if (!listing) notFound();

  const confidenceLabel =
    listing.descriptionConfidence >= 0.8
      ? 'High'
      : listing.descriptionConfidence >= 0.5
        ? 'Medium'
        : 'Low';

  const confidenceColor =
    listing.descriptionConfidence >= 0.8
      ? 'text-green-600 dark:text-green-400'
      : listing.descriptionConfidence >= 0.5
        ? 'text-yellow-600 dark:text-yellow-400'
        : 'text-red-600 dark:text-red-400';

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* Back link */}
      <Link
        href="/marketplace"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Marketplace
      </Link>

      {/* Header card */}
      <Card className="p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="space-y-1">
            <h1 className="font-display text-2xl font-bold">{listing.title || 'Untitled API'}</h1>
            {listing.description && (
              <p className="text-muted-foreground">{listing.description}</p>
            )}
          </div>
          <div className="text-right shrink-0">
            <div className="text-2xl font-bold">{listing.price.humanReadable ?? formatPrice(listing.price.amount, listing.price.decimals) ?? 'Free'}</div>
            <div className="text-xs text-muted-foreground">per call</div>
          </div>
        </div>

        {/* Badges */}
        <div className="flex flex-wrap gap-2 mb-4">
          {listing.category && (
            <Badge variant="secondary">{listing.category}</Badge>
          )}
          <Badge variant="outline">{listing.price.network}</Badge>
          <Badge variant="outline">{listing.type.toUpperCase()}</Badge>
          {listing.httpMethod && (
            <Badge variant="outline">{listing.httpMethod}</Badge>
          )}
          {listing.isVerified && (
            <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
              <Shield className="h-3 w-3 mr-1" /> Verified
            </Badge>
          )}
          {listing.isStale && (
            <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300">
              <AlertTriangle className="h-3 w-3 mr-1" /> Stale
            </Badge>
          )}
        </div>

      </Card>

      {/* Technical details */}
      <Card className="p-6 space-y-5">
        <h2 className="font-display text-xl font-semibold">Technical Details</h2>

        {/* Resource URL */}
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Endpoint</h3>
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
            <code className="text-sm break-all bg-muted/50 px-2 py-1 rounded">{listing.resourceUrl}</code>
          </div>
        </div>

        {/* HTTP Method */}
        {listing.httpMethod && (
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">HTTP Method</h3>
            <Badge variant="outline" className="font-mono">{listing.httpMethod}</Badge>
          </div>
        )}

        {/* MCP Tool */}
        {listing.mcpToolName && (
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">MCP Tool Name</h3>
            <code className="text-sm bg-muted/50 px-2 py-1 rounded">{listing.mcpToolName}</code>
          </div>
        )}

        {/* Input Schema */}
        {listing.inputSchema && Object.keys(listing.inputSchema).length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Input Schema</h3>
            <pre className="text-xs bg-muted/50 p-3 rounded-lg overflow-x-auto max-h-64">
              {JSON.stringify(listing.inputSchema, null, 2)}
            </pre>
          </div>
        )}

        {/* Output Schema */}
        {listing.outputSchema && Object.keys(listing.outputSchema).length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Output Schema</h3>
            <pre className="text-xs bg-muted/50 p-3 rounded-lg overflow-x-auto max-h-64">
              {JSON.stringify(listing.outputSchema, null, 2)}
            </pre>
          </div>
        )}

        {/* Timeout */}
        {listing.maxTimeoutSeconds && (
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">Max timeout: {listing.maxTimeoutSeconds}s</span>
          </div>
        )}

        {/* Pricing details */}
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Pricing</h3>
          <div className="text-sm space-y-1">
            <div>Raw amount: <code className="bg-muted/50 px-1 rounded">{listing.price.amount}</code> ({listing.price.decimals} decimals)</div>
            {listing.price.tokenName && <div>Token: {listing.price.tokenName}</div>}
            {listing.price.asset && <div>Asset: <code className="bg-muted/50 px-1 rounded text-xs break-all">{listing.price.asset}</code></div>}
            {listing.payTo && <div>Pay to: <code className="bg-muted/50 px-1 rounded text-xs break-all">{listing.payTo}</code></div>}
          </div>
        </div>

        {/* Facilitators */}
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Sources</h3>
          <div className="flex flex-wrap gap-2">
            {listing.facilitators.map((f) => (
              <Badge key={f.name} variant="outline">
                {f.name} &middot; seen {new Date(f.lastSeen).toLocaleDateString()}
              </Badge>
            ))}
          </div>
        </div>

        {/* Confidence */}
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Description Confidence</h3>
          <span className={`text-sm font-medium ${confidenceColor}`}>
            {confidenceLabel} ({(listing.descriptionConfidence * 100).toFixed(0)}%)
          </span>
          {listing.enrichmentSource && (
            <span className="text-xs text-muted-foreground ml-2">
              Source: {listing.enrichmentSource}
            </span>
          )}
        </div>

        {/* Timestamps */}
        <div className="text-xs text-muted-foreground space-y-0.5">
          <div>First seen: {new Date(listing.firstSeenAt).toLocaleDateString()}</div>
          <div>Last seen: {new Date(listing.lastSeenAt).toLocaleDateString()}</div>
          <div>x402 version: {listing.x402Version}</div>
        </div>
      </Card>

      {/* Reviews */}
      <MarketplaceReviews listingId={listing.id} />
    </div>
  );
}
