import { Card } from '@/components/ui';

function Pulse({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-muted ${className ?? ''}`} />;
}

export default function MarketplaceDetailLoading() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* Back link */}
      <Pulse className="h-4 w-36" />

      {/* Header card */}
      <Card className="p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="space-y-2 flex-1">
            <Pulse className="h-7 w-2/3" />
            <Pulse className="h-4 w-full" />
            <Pulse className="h-4 w-4/5" />
          </div>
          <div className="text-right shrink-0 space-y-1">
            <Pulse className="h-8 w-16 ml-auto" />
            <Pulse className="h-3 w-12 ml-auto" />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Pulse className="h-6 w-20 rounded-full" />
          <Pulse className="h-6 w-16 rounded-full" />
          <Pulse className="h-6 w-14 rounded-full" />
        </div>
      </Card>

      {/* Technical details */}
      <Card className="p-6 space-y-5">
        <Pulse className="h-6 w-40" />

        <div className="space-y-3">
          <Pulse className="h-3 w-16" />
          <Pulse className="h-8 w-full" />
        </div>

        <div className="space-y-3">
          <Pulse className="h-3 w-20" />
          <Pulse className="h-6 w-14 rounded-full" />
        </div>

        <div className="space-y-3">
          <Pulse className="h-3 w-24" />
          <Pulse className="h-32 w-full rounded-lg" />
        </div>

        <div className="space-y-3">
          <Pulse className="h-3 w-16" />
          <div className="space-y-1">
            <Pulse className="h-4 w-48" />
            <Pulse className="h-4 w-32" />
          </div>
        </div>

        <div className="space-y-3">
          <Pulse className="h-3 w-14" />
          <div className="flex gap-2">
            <Pulse className="h-6 w-36 rounded-full" />
            <Pulse className="h-6 w-28 rounded-full" />
          </div>
        </div>

        <div className="space-y-1">
          <Pulse className="h-3 w-40" />
          <Pulse className="h-3 w-36" />
          <Pulse className="h-3 w-28" />
        </div>
      </Card>

      {/* Reviews skeleton */}
      <Card className="p-6 space-y-4">
        <Pulse className="h-6 w-24" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-2 border-t border-border/50 pt-4 first:border-0 first:pt-0">
            <div className="flex items-center gap-2">
              <Pulse className="h-8 w-8 rounded-full" />
              <div className="space-y-1">
                <Pulse className="h-4 w-24" />
                <Pulse className="h-3 w-16" />
              </div>
            </div>
            <div className="flex gap-0.5">
              {Array.from({ length: 5 }).map((_, j) => (
                <Pulse key={j} className="h-4 w-4" />
              ))}
            </div>
            <Pulse className="h-4 w-full" />
            <Pulse className="h-4 w-3/4" />
          </div>
        ))}
      </Card>
    </div>
  );
}
