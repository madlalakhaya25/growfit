import type { MilestoneCategory } from "@/app/actions/development";

export interface MilestoneTemplate {
  id: string;
  title: string;
  description: string | null;
  category: MilestoneCategory;
  position: string | null;
  age_group: string | null;
  sort_order: number;
}

/**
 * Milestone progress across the five development categories.
 *
 * Lifted out of the player passport page when development moved to its own
 * page — the markup was ~130 lines inline, and both pages want the same view.
 */
export function MilestoneProgress({
  templates,
  completed,
}: {
  templates: MilestoneTemplate[];
  completed: Set<string>;
}) {
      const CATEGORIES: MilestoneCategory[] = ["technical", "tactical", "physical", "mental", "leadership"];
      const CATEGORY_LABELS: Record<MilestoneCategory, string> = {
        technical: "Technical", tactical: "Tactical", physical: "Physical",
        mental: "Mental", leadership: "Leadership",
      };
      const CATEGORY_STYLES: Record<MilestoneCategory, string> = {
        technical: "bg-blue-500/15 text-blue-700 border-transparent",
        tactical: "bg-violet-500/15 text-violet-700 border-transparent",
        physical: "bg-orange-500/15 text-orange-700 border-transparent",
        mental: "bg-teal-500/15 text-teal-700 border-transparent",
        leadership: "bg-amber-500/15 text-amber-700 border-transparent",
      };

      const totalCount = templates.length;
      const doneCount = templates.filter((t) => completed.has(t.id)).length;
      const overallPct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

      const CATEGORY_BAR_COLORS: Record<MilestoneCategory, string> = {
        technical: "bg-blue-500",
        tactical: "bg-violet-500",
        physical: "bg-orange-500",
        mental: "bg-teal-500",
        leadership: "bg-amber-500",
      };

      return (
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold">My Development</h2>
            <span className="text-sm text-muted-foreground font-medium">
              {doneCount}/{totalCount} &middot; {overallPct}%
            </span>
          </div>

          {/* Overall progress bar */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
              <span>Overall progress</span>
              <span>{overallPct}% complete</span>
            </div>
            <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${overallPct}%` }}
              />
            </div>
            <div className="grid grid-cols-5 gap-1.5 pt-1">
              {CATEGORIES.map((cat) => {
                const catItems = templates.filter((t) => t.category === cat);
                if (catItems.length === 0) return null;
                const catDone = catItems.filter((t) => completed.has(t.id)).length;
                const catPct = Math.round((catDone / catItems.length) * 100);
                return (
                  <div key={cat} className="space-y-1">
                    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${CATEGORY_BAR_COLORS[cat]}`}
                        style={{ width: `${catPct}%` }}
                      />
                    </div>
                    <p className="text-[9px] text-center text-muted-foreground uppercase tracking-wide truncate">
                      {CATEGORY_LABELS[cat]}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {CATEGORIES.map((cat) => {
            const items = templates.filter((t) => t.category === cat);
            if (items.length === 0) return null;
            return (
              <div key={cat} className="space-y-2">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    {CATEGORY_LABELS[cat]}
                  </p>
                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${CATEGORY_STYLES[cat]}`}>
                    {items.filter((t) => completed.has(t.id)).length}/{items.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {items.map((t) => {
                    const done = completed.has(t.id);
                    return (
                      <div key={t.id} className="flex gap-3 rounded-xl border border-border bg-card p-4">
                        <div className="mt-0.5 flex-shrink-0 size-5 rounded-full border-2 border-border flex items-center justify-center"
                          style={done ? { backgroundColor: "currentColor", borderColor: "currentColor" } : undefined}>
                          {done && (
                            <svg viewBox="0 0 12 12" className="size-full text-white" fill="none" stroke="currentColor" strokeWidth={2.5}>
                              <path d="M2 6l3 3 5-5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </div>
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className={`text-sm font-medium leading-snug ${done ? "text-muted-foreground" : ""}`}>
                              {t.title}
                            </p>
                            <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium shrink-0 ${CATEGORY_STYLES[cat]}`}>
                              {CATEGORY_LABELS[cat]}
                            </span>
                          </div>
                          {t.description && (
                            <p className="text-xs text-muted-foreground leading-snug">{t.description}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </section>
      );
}
