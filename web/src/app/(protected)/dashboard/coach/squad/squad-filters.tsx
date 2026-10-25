"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Search } from "lucide-react";
import { FilterChip } from "@/components/ui/filter-chip";

export type SquadFilter = "all" | "attendance" | "docs" | "injured" | "unassessed";

/**
 * Search and filter for the coach's own squad.
 *
 * The admin player list has had search since it was built; the squad page —
 * the screen a coach opens most — accepted exactly one search param (`team`)
 * and offered no way to find anyone. Across U11, U13 and U15 that is roughly
 * 45 players grouped by position and nothing else.
 *
 * The filters are the questions a coach actually arrives with, and each is
 * answered from data the app already computed: who needs a word (below the
 * attendance policy, or flagged for a check-in), who still owes a form, who
 * is injured or unavailable, who has never been assessed.
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
    { id: "attendance", label: "Needs a word" },
    { id: "docs", label: "Forms due" },
    { id: "injured", label: "Injured" },
    { id: "unassessed", label: "Not assessed" },
  ];

  return (
    <div className="space-y-3">
      <div className="relative sm:max-w-sm">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground"
          aria-hidden="true"
        />
        <input
          type="search"
          placeholder="Find a player"
          aria-label="Find a player"
          defaultValue={initialQuery}
          onChange={(e) => setParam("q", e.target.value || null)}
          className="flex h-11 w-full rounded-xl border border-input bg-card pl-9 pr-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      {/* One scrolling row on a phone, so the list starts higher up. */}
      <div role="group" aria-label="Filter the squad" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
        {FILTERS.map(({ id, label }) => {
          const count = counts[id];
          const isActive = active === id;
          // A filter that would show nothing is disabled rather than hidden:
          // "no one is below 75%" is useful information, and a chip that
          // comes and goes is harder to learn than one that greys out.
          const empty = count === 0 && id !== "all";
          return (
            <FilterChip
              key={id}
              active={isActive}
              count={count}
              disabled={empty}
              onClick={() => setParam("filter", id === "all" ? null : id)}
              className="shrink-0"
            >
              {label}
            </FilterChip>
          );
        })}
      </div>
    </div>
  );
}
