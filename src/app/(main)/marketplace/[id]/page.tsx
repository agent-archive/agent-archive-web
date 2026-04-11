import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Copy, Globe, Clock, Shield, AlertTriangle, Zap, DollarSign, Database, Users, BarChart3 } from 'lucide-react';
import { getListingById } from '@/lib/server/marketplace-service';
import { hasDatabase } from '@/lib/server/db';
import { getSeededMarketplaceListing } from '@/lib/seeded-marketplace';
import { formatPrice } from '@/lib/utils';
import { generateCodeSnippets } from '@/lib/snippet-generator';
import { Card, Badge } from '@/components/ui';
import { CodeSnippets } from '@/components/marketplace/code-snippets';
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
        <div className="border-l-2 border-blue-400 dark:border-blue-500 pl-4">
          <h3 className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-1">Endpoint</h3>
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-blue-500 dark:text-blue-400 shrink-0" />
            <code className="text-sm break-all bg-blue-50 dark:bg-blue-950/30 px-2 py-1 rounded text-blue-800 dark:text-blue-200">{listing.resourceUrl}</code>
          </div>
        </div>

        {/* HTTP Method */}
        {listing.httpMethod && (
          <div className="border-l-2 border-blue-400 dark:border-blue-500 pl-4">
            <h3 className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-1">HTTP Method</h3>
            <Badge variant="outline" className={`font-mono font-semibold ${
              listing.httpMethod === 'GET' ? 'border-green-300 text-green-700 bg-green-50 dark:border-green-700 dark:text-green-300 dark:bg-green-950/30' :
              listing.httpMethod === 'POST' ? 'border-blue-300 text-blue-700 bg-blue-50 dark:border-blue-700 dark:text-blue-300 dark:bg-blue-950/30' :
              listing.httpMethod === 'PUT' ? 'border-orange-300 text-orange-700 bg-orange-50 dark:border-orange-700 dark:text-orange-300 dark:bg-orange-950/30' :
              listing.httpMethod === 'DELETE' ? 'border-red-300 text-red-700 bg-red-50 dark:border-red-700 dark:text-red-300 dark:bg-red-950/30' :
              'border-muted-foreground'
            }`}>{listing.httpMethod}</Badge>
          </div>
        )}

        {/* MCP Tool */}
        {listing.mcpToolName && (
          <div className="border-l-2 border-violet-400 dark:border-violet-500 pl-4">
            <h3 className="text-xs font-semibold text-violet-600 dark:text-violet-400 uppercase tracking-wider mb-1">MCP Tool Name</h3>
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-violet-500 dark:text-violet-400 shrink-0" />
              <code className="text-sm bg-violet-50 dark:bg-violet-950/30 px-2 py-1 rounded text-violet-800 dark:text-violet-200">{listing.mcpToolName}</code>
            </div>
          </div>
        )}

        {/* Input Schema */}
        {listing.inputSchema && Object.keys(listing.inputSchema).length > 0 && (
          <div className="border-l-2 border-purple-400 dark:border-purple-500 pl-4">
            <h3 className="text-xs font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <Database className="h-3.5 w-3.5" />
              Input Schema
            </h3>
            <pre className="text-xs bg-purple-50 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/40 p-3 rounded-lg overflow-x-auto max-h-64 text-purple-900 dark:text-purple-100">
              {JSON.stringify(listing.inputSchema, null, 2)}
            </pre>
          </div>
        )}

        {/* Output Schema */}
        {listing.outputSchema && Object.keys(listing.outputSchema).length > 0 && (
          <div className="border-l-2 border-cyan-400 dark:border-cyan-500 pl-4">
            <h3 className="text-xs font-semibold text-cyan-600 dark:text-cyan-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <Database className="h-3.5 w-3.5" />
              Output Schema
            </h3>
            <pre className="text-xs bg-cyan-50 dark:bg-cyan-950/20 border border-cyan-100 dark:border-cyan-900/40 p-3 rounded-lg overflow-x-auto max-h-64 text-cyan-900 dark:text-cyan-100">
              {JSON.stringify(listing.outputSchema, null, 2)}
            </pre>
          </div>
        )}

        {/* Timeout */}
        {listing.maxTimeoutSeconds && (
          <div className="border-l-2 border-amber-400 dark:border-amber-500 pl-4 flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-500 dark:text-amber-400" />
            <span className="text-sm">Max timeout: <span className="font-semibold text-amber-700 dark:text-amber-300">{listing.maxTimeoutSeconds}s</span></span>
          </div>
        )}

        {/* Pricing details */}
        <div className="border-l-2 border-green-400 dark:border-green-500 pl-4">
          <h3 className="text-xs font-semibold text-green-600 dark:text-green-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <DollarSign className="h-3.5 w-3.5" />
            Pricing
          </h3>
          <div className="text-sm space-y-1">
            <div>Raw amount: <code className="bg-green-50 dark:bg-green-950/30 px-1 rounded text-green-800 dark:text-green-200 font-semibold">{listing.price.amount}</code> ({listing.price.decimals} decimals)</div>
            {listing.price.tokenName && <div>Token: <span className="font-medium text-green-700 dark:text-green-300">{listing.price.tokenName}</span></div>}
            {listing.price.asset && <div>Asset: <code className="bg-green-50 dark:bg-green-950/30 px-1 rounded text-xs break-all text-green-800 dark:text-green-200">{listing.price.asset}</code></div>}
            {listing.payTo && <div>Pay to: <code className="bg-green-50 dark:bg-green-950/30 px-1 rounded text-xs break-all text-green-800 dark:text-green-200">{listing.payTo}</code></div>}
          </div>
        </div>

        {/* Facilitators */}
        <div className="border-l-2 border-orange-400 dark:border-orange-500 pl-4">
          <h3 className="text-xs font-semibold text-orange-600 dark:text-orange-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" />
            Sources
          </h3>
          <div className="flex flex-wrap gap-2">
            {listing.facilitators.map((f) => (
              <Badge key={f.name} variant="outline" className="border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-300 bg-orange-50 dark:bg-orange-950/20">
                {f.name} &middot; seen {new Date(f.lastSeen).toLocaleDateString()}
              </Badge>
            ))}
          </div>
        </div>

        {/* Confidence */}
        <div className="border-l-2 border-rose-400 dark:border-rose-500 pl-4">
          <h3 className="text-xs font-semibold text-rose-600 dark:text-rose-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <BarChart3 className="h-3.5 w-3.5" />
            Description Confidence
          </h3>
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
        <div className="text-xs text-muted-foreground space-y-0.5 border-l-2 border-muted pl-4">
          <div>First seen: {new Date(listing.firstSeenAt).toLocaleDateString()}</div>
          <div>Last seen: {new Date(listing.lastSeenAt).toLocaleDateString()}</div>
          <div>x402 version: {listing.x402Version}</div>
        </div>
      </Card>

      {/* Code Snippets */}
      {listing.resourceUrl && (
        <CodeSnippets snippets={generateCodeSnippets(listing)} />
      )}

      {/* Reviews */}
      <MarketplaceReviews listingId={listing.id} />
    </div>
  );
}
