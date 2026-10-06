import { Skeleton } from "@/components/ui/skeleton";

/** The session and its register: a title, then one row per player with four mark buttons, so nothing jumps when it loads. */
export default function SessionLoading() {
  return (
    <output className="block space-y-5" aria-label="Loading the session">
      <div className="space-y-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-40" />
      </div>
      <div className="divide-y divide-border rounded-xl border border-border">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="flex items-center justify-between gap-3 px-4 py-3">
            <Skeleton className="h-5 w-36" />
            <div className="flex gap-2">
              {Array.from({ length: 4 }, (_, j) => <Skeleton key={j} className="size-11 rounded-full" />)}
            </div>
          </div>
        ))}
      </div>
    </output>
  );
}
