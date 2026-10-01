import { StatBar } from "@/components/ui/stat-bar";
import {
  MILESTONE_CATEGORIES,
  MILESTONE_CATEGORY_META,
  summariseByCategory,
} from "@/lib/development-categories";
import type { MilestoneTemplate } from "@/lib/development-data";

/**
 * Per-corner progress for one season.
 *
 * Two shapes, because the denominator is only honest for the CURRENT season:
 *
 *  - `totals`: a bar per corner with done/total. Right for this season, where
 *    "total" is the pathway the player is working through now.
 *  - counts only: a chip per corner showing how many were completed. Used for
 *    past seasons, where measuring against today's template list would
 *    misrepresent them -- templates are added and removed between seasons, so
 *    "3 of 9" last year might really have been "3 of 5" at the time.
 */
export function SeasonProgress({
  templates,
  completedTemplateIds,
  totals,
}: {
  templates: readonly MilestoneTemplate[];
  completedTemplateIds: ReadonlySet<string>;
  totals: boolean;
}) {
  if (totals) {
    const { byCategory } = summariseByCategory(templates, completedTemplateIds);
    if (byCategory.length === 0) return null;
    return (
      <div className="space-y-2">
        {byCategory.map(({ key, meta, done, total, pct }) => (
          <div key={key} className="flex items-center gap-2">
            <StatBar label={meta.label} value={pct ?? 0} color={meta.cssVar} className="flex-1" />
            <span className="w-9 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
              {done}/{total}
            </span>
          </div>
        ))}
      </div>
    );
  }

  const byTemplate = new Map(templates.map((t) => [t.id, t.category]));
  const counts = new Map<string, number>();
  for (const id of completedTemplateIds) {
    const cat = byTemplate.get(id);
    if (cat) counts.set(cat, (counts.get(cat) ?? 0) + 1);
  }
  const shown = MILESTONE_CATEGORIES.filter((k) => (counts.get(k) ?? 0) > 0);
  if (shown.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {shown.map((key) => {
        const meta = MILESTONE_CATEGORY_META[key];
        return (
          <span key={key} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${meta.chip}`}>
            <meta.Icon className="size-3" aria-hidden="true" />
            {meta.label} {counts.get(key)}
          </span>
        );
      })}
    </div>
  );
}
