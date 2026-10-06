import { Skeleton } from "@/components/ui/skeleton";

/** The match: the scoreline band, then the squad list, so nothing jumps when it loads. */
export default function MatchLoading() {
  return (
    <output className="block space-y-5" aria-label="Loading the match">
      <Skeleton className="h-32 w-full rounded-2xl" />
      <div className="divide-y divide-border rounded-xl border border-border">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="flex items-center justify-between gap-3 px-4 py-3">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-8 w-20 rounded-full" />
          </div>
        ))}
      </div>
    </output>
  );
}
