"use client";

import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { EmptyState } from "@/components/ui/empty-state";
import {
  LIBRARY_AGE_GROUPS, DRILL_THEMES, filterDrills, sortDrills, toggleChip,
  type LibraryAgeGroup, type DrillTheme,
} from "@/lib/drill-library";
import type { LibraryDrillRow, LibraryPlay, SessionChoice } from "@/lib/drill-library-data";
import { LibraryDrillListItem } from "./library-drill-row";
import { LibraryDrillForm } from "./library-drill-form";
import { AddToSessionSheet } from "./add-to-session-sheet";

function FilterChip({ label, selected, onToggle }: Readonly<{ label: string; selected: boolean; onToggle: () => void }>) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onToggle}
      className={`min-h-9 shrink-0 rounded-full px-3.5 text-sm font-medium transition-colors ${
        selected ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"
      }`}
    >
      {label}
    </button>
  );
}

function ChipRow({ label, children }: Readonly<{ label: string; children: React.ReactNode }>) {
  return (
    <fieldset className="min-w-0">
      <legend className="sr-only">{label}</legend>
      {/* py-1 keeps each chip's tap area near 44px while it scrolls sideways */}
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 py-1 [scrollbar-width:none]">{children}</div>
    </fieldset>
  );
}

const AGE_LABEL: Record<LibraryAgeGroup, string> = { U11: "U11", U13: "U13", U15: "U15" };

export function LibraryBrowser({
  drills,
  plays,
  sessions,
  isAdmin,
  canPlan,
  tagsReady,
}: Readonly<{
  drills: readonly LibraryDrillRow[];
  plays: readonly LibraryPlay[];
  sessions: readonly SessionChoice[];
  isAdmin: boolean;
  canPlan: boolean;
  tagsReady: boolean;
}>) {
  const [query, setQuery] = useState("");
  const [ages, setAges] = useState<LibraryAgeGroup[]>([]);
  const [themes, setThemes] = useState<DrillTheme[]>([]);
  const [adding, setAdding] = useState(false);
  const [planning, setPlanning] = useState<{ id: string; name: string } | null>(null);

  const playById = useMemo(() => new Map(plays.map((p) => [p.id, p])), [plays]);
  const shown = useMemo(
    () => sortDrills(filterDrills(drills, { query, ageGroups: ages, themes })),
    [drills, query, ages, themes]
  );
  const filtering = query.trim() !== "" || ages.length > 0 || themes.length > 0;
  const perms = { isAdmin, canPlan, tagsReady };
  const emptyMessage = filtering
    ? "No drills match. Try fewer filters."
    : "No drills yet. Add the first one the academy should share.";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <label className="relative flex-1">
          <span className="sr-only">Search drills</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search drills"
            className="h-11 w-full rounded-[10px] bg-secondary pl-9 pr-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>
        <Button type="button" className="h-11 shrink-0" onClick={() => setAdding(true)}>
          <Plus className="size-4" aria-hidden="true" /> New
        </Button>
      </div>

      {tagsReady && (
        <div className="space-y-1">
          <ChipRow label="Age group">
            {LIBRARY_AGE_GROUPS.map((a) => (
              <FilterChip key={a} label={AGE_LABEL[a]} selected={ages.includes(a)} onToggle={() => setAges((s) => toggleChip(s, a))} />
            ))}
          </ChipRow>
          <ChipRow label="Theme">
            {DRILL_THEMES.map((t) => (
              <FilterChip key={t.value} label={t.label} selected={themes.includes(t.value)} onToggle={() => setThemes((s) => toggleChip(s, t.value))} />
            ))}
          </ChipRow>
        </div>
      )}

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{shown.length} {shown.length === 1 ? "drill" : "drills"}</span>
        {filtering && (
          <button type="button" className="min-h-11 px-2 font-medium text-primary" onClick={() => { setQuery(""); setAges([]); setThemes([]); }}>
            Clear
          </button>
        )}
      </div>

      <div className="overflow-hidden rounded-xl bg-card shadow-sm ring-1 ring-border">
        {shown.length === 0 ? (
          <EmptyState message={emptyMessage} />
        ) : (
          <ul className="divide-y divide-border">
            {shown.map((d) => (
              <LibraryDrillListItem
                key={d.id}
                drill={d}
                play={d.tactic_play_id ? playById.get(d.tactic_play_id) : undefined}
                plays={plays}
                perms={perms}
                onPlan={() => setPlanning({ id: d.id, name: d.name })}
              />
            ))}
          </ul>
        )}
      </div>

      <Sheet open={adding} onClose={() => setAdding(false)} title="New library drill">
        <LibraryDrillForm plays={plays} tagsReady={tagsReady} onDone={() => setAdding(false)} />
      </Sheet>
      <AddToSessionSheet drill={planning} sessions={sessions} onClose={() => setPlanning(null)} />
    </div>
  );
}
