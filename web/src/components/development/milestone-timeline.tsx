import { Check, History } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ListRow, ListRowGroup } from "@/components/ui/list-row";
import { RetryButton } from "@/components/ui/retry-button";
import { SeasonProgress } from "@/components/development/season-progress";
import { MILESTONE_CATEGORY_META, categoryMeta } from "@/lib/development-categories";
import type { DevelopmentSnapshot } from "@/lib/development-data";
import type { DevelopmentAudience } from "@/components/development/development-overview";
import { formatDayMonthYear } from "@/lib/time";

/** Who signed a milestone off, worded for whoever is reading. */
function signedOffBy(audience: DevelopmentAudience, name: string | null): string {
  if (name) return name;
  // Null is the normal case off the coach surface -- profiles RLS hides the
  // coach's name from a player or parent -- so never print an empty string.
  return audience === "player" ? "your coach" : audience === "parent" ? "the coaches" : "a coach";
}

/**
 * What a player achieved and when, newest season first and newest milestone
 * first inside it. Reads the `completed_at` / `completed_by` / `season`
 * columns migration 012 has always stored.
 *
 * No chart on purpose: a handful of rows per season, and a line over them
 * would be decoration.
 */
export function MilestoneTimeline({
  snapshot,
  audience,
}: {
  snapshot: DevelopmentSnapshot;
  audience: DevelopmentAudience;
}) {
  if (snapshot.loadError) {
    return (
      <Card>
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 text-sm">
          <span className="text-destructive">{snapshot.loadError}</span>
          <RetryButton />
        </div>
      </Card>
    );
  }

  const titleById = new Map(snapshot.templates.map((t) => [t.id, t]));
  const hasAny = snapshot.seasons.some((s) => s.completions.length > 0);

  if (!hasAny) {
    return (
      <Card>
        <EmptyState icon={History} message="Nothing signed off yet. Milestones appear here as they're completed." />
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {snapshot.seasons.map((season) => {
        const isCurrent = season.season === snapshot.currentSeason;
        // A past season with nothing in it is noise.
        if (!isCurrent && season.completions.length === 0) return null;
        const ids = new Set(season.completions.map((c) => c.templateId));
        return (
          <section key={season.season} className="space-y-3" aria-label={`${season.season} season`}>
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="text-base font-semibold">{season.season} season</h3>
              <span className="text-xs text-muted-foreground">
                {season.completions.length} milestone{season.completions.length === 1 ? "" : "s"}
              </span>
            </div>

            <SeasonProgress templates={snapshot.templates} completedTemplateIds={ids} totals={isCurrent} />

            {season.completions.length === 0 ? (
              <Card>
                <EmptyState message="Nothing signed off yet this season." />
              </Card>
            ) : (
              <Card>
                <ListRowGroup className="px-4 py-3">
                  {season.completions.map((c) => {
                    const t = titleById.get(c.templateId);
                    const meta = categoryMeta(t?.category) ?? null;
                    const when = c.completedAt ? formatDayMonthYear(c.completedAt) : null;
                    const subtitle = [
                      [when, signedOffBy(audience, c.completedByName)].filter(Boolean).join(" · "),
                      c.note ? `“${c.note}”` : null,
                    ]
                      .filter(Boolean)
                      .join("\n");
                    return (
                      <ListRow
                        key={`${c.season}-${c.templateId}`}
                        leading={
                          // One bg-* at a time. A milestone no longer in the
                          // pathway has no category, so it gets a neutral dot.
                          <span
                            className={`grid size-6 place-items-center rounded-full ${
                              meta ? MILESTONE_CATEGORY_META[meta.key].fill : "bg-muted"
                            }`}
                            title={meta?.label}
                          >
                            <Check
                              className={`size-3.5 ${meta ? "text-background" : "text-muted-foreground"}`}
                              strokeWidth={3}
                              aria-hidden="true"
                            />
                          </span>
                        }
                        title={<span className="whitespace-normal">{t?.title ?? "A milestone no longer in the pathway"}</span>}
                        subtitle={subtitle}
                        wrapSubtitle
                        trailing={
                          meta ? (
                            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${meta.chip}`}>
                              <meta.Icon className="size-3" aria-hidden="true" />
                              {meta.label}
                            </span>
                          ) : undefined
                        }
                      />
                    );
                  })}
                </ListRowGroup>
              </Card>
            )}
          </section>
        );
      })}
    </div>
  );
}
