import { Skeleton } from "@/components/ui/skeleton";

export default function SquadLoading() {
  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between">
        <div className="space-y-1">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-9 w-32 rounded-full" />
      </div>
      <Skeleton className="h-11 w-full rounded-xl sm:max-w-sm" />
      {["Goalkeepers", "Defence", "Midfield"].map((pos) => (
        <section key={pos} className="space-y-2">
          <Skeleton className="h-3 w-24" />
          <div className="divide-y divide-hairline rounded-2xl border border-hairline bg-card">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex min-h-16 items-center gap-3 px-3.5 py-2.5">
                <Skeleton className="size-11 shrink-0 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-4 w-24 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
