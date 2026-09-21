"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

export type SquadFilter = "all" | "attendance" | "docs" | "unassessed";

/**
 * Search and filter for the coach's own squad.
 *
 * The admin player list has had search since it was built; the squad page —
 * the screen a coach opens most — accepted exactly one search param (`team`)
 * and offered no way to find anyone. Across U11, U13 and U15 that is roughly
 * 45 players grouped by position and nothing else.
 *
 * The three filters are the questions a coach actually arrives with, and
 * each is answered from data the app already computed but never showed
 * here: who is below the attendance policy, who still owes a form, who has
 * never been assessed.
 *
 * State lives in the URL so a filtered squad can be linked or reloaded, and
 * so the server component does the filtering rather than shipping the whole
 * squad to the browser to hide most of it.
 */
export function SquadFilters({
  initialQuery,
  active,
  counts,
}: {
  initialQuery: string;
  active: SquadFilter;
  counts: Record<SquadFilter, number>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, start] = useTransition();

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    start(() => router.replace(`${pathname}?${next.toString()}`));
  }

  const FILTERS: { id: SquadFilter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "attendance", label: "Below 75%" },
    { id: "docs", label: "Docs outstanding" },
    { id: "unassessed", label: "Not assessed" },
  ];

  return (
    <div className="space-y-3">
      <div className="relative max-w-sm">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground"
          aria-hidden="true"
        />
        <input
          type="search"
          placeholder="Search this squad…"
          aria-label="Search this squad"
          defaultValue={initialQuery}
          onChange={(e) => setParam("q", e.target.value || null)}
          className="flex h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map(({ id, label }) => {
          const count = counts[id];
          const isActive = active === id;
          // A filter that would show nothing is disabled rather than hidden:
          // "no one is below 75%" is useful information, and a chip that
          // comes and goes is harder to learn than one that greys out.
          const empty = count === 0 && id !== "all";
          return (
            <button
              key={id}
              type="button"
              disabled={empty}
              aria-pressed={isActive}
              onClick={() => setParam("filter", id === "all" ? null : id)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                isActive
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:border-primary/50",
                empty && "opacity-40 cursor-not-allowed hover:border-border"
              )}
            >
              {label}
              <span className={cn("ml-1.5", !isActive && "text-muted-foreground/70")}>
                {count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
