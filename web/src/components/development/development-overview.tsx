import { Check, Flag } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { InfoTip } from "@/components/ui/info-tip";
import { ListRow, ListRowGroup } from "@/components/ui/list-row";
import { RetryButton } from "@/components/ui/retry-button";
import { StatBar } from "@/components/ui/stat-bar";
import { StatTile } from "@/components/ui/stat-tile";
import { MilestoneCard } from "@/components/development/milestone-card";
import {
  MILESTONE_CATEGORIES,
  MILESTONE_CATEGORY_META,
  summariseByCategory,
} from "@/lib/development-categories";
import type { DevelopmentSnapshot } from "@/lib/development-data";

export type DevelopmentAudience = "coach" | "player" | "parent";

const EMPTY_MESSAGE: Record<DevelopmentAudience, string> = {
  coach: "No milestones set for this player's position and age group yet. Your admin adds them under Development Pathways.",
  player: "No milestones set for you yet. Your coach adds these at the start of the season.",
  parent: "No milestones have been set for your child yet. The coaches add these at the start of the season.",
};

/**
 * The milestone pathway for one player: a summary, a bar per category, and the
 * milestones grouped by category. One server component for every audience,
 * read-only or interactive, replacing the inline block on the coach page and
 * the separate MilestoneProgress the player page had.
 *
 * `playerId` makes it interactive (coach/admin: each milestone is a toggle).
 * Without it every milestone renders as a read-only row. Passing a player id
 * to a player's or parent's view would hand them a toggle that RLS then
 * rejects, so only the coach page passes it.
 *
 * A failed load renders as an error with a retry, never as an empty pathway --
 * "no milestones yet" for a child whose milestones merely failed to load is
 * the same lie BACKLOG.md 4.1 fixed on Today.
 */
export function DevelopmentOverview({
  snapshot,
  audience,
  playerId,
}: {
  snapshot: DevelopmentSnapshot;
  audience: DevelopmentAudience;
  playerId?: string;
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

  const { templates, completedThisSeason, currentNotes, currentSeason } = snapshot;

  if (templates.length === 0) {
    return (
      <Card>
        <EmptyState icon={Flag} message={EMPTY_MESSAGE[audience]} />
      </Card>
    );
  }

  const progress = summariseByCategory(templates, completedThisSeason);

  return (
    <section className="space-y-5" aria-label="Development milestones">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-base font-semibold">
          {currentSeason} season
          {audience === "coach" && (
            <InfoTip>
              Tick a milestone once the player shows it consistently. Milestones are set for the whole
              academy under Development Pathways.
            </InfoTip>
          )}
        </h2>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <StatTile label="Done" value={progress.overall.done} />
        <StatTile label="To go" value={progress.overall.total - progress.overall.done} />
        <StatTile label="Complete" value={progress.overall.pct === null ? null : `${progress.overall.pct}%`} />
      </div>

      <Card>
        <CardContent className="space-y-3 pt-4">
          {progress.byCategory.map(({ key, meta, pct }) => (
            <StatBar
              key={key}
              label={meta.label}
              value={pct ?? 0}
              color={meta.cssVar}
            />
          ))}
        </CardContent>
      </Card>

      {MILESTONE_CATEGORIES.map((key) => {
        const items = templates.filter((t) => t.category === key);
        if (items.length === 0) return null;
        const meta = MILESTONE_CATEGORY_META[key];
        const done = items.filter((t) => completedThisSeason.has(t.id)).length;
        return (
          <div key={key} className="space-y-2">
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${meta.chip}`}>
                <meta.Icon className="size-3.5" aria-hidden="true" />
                {meta.label}
              </span>
              <span className="text-xs text-muted-foreground">
                {done}/{items.length}
              </span>
            </div>

            {playerId ? (
              <div className="space-y-2">
                {items.map((t) => (
                  <MilestoneCard
                    key={t.id}
                    templateId={t.id}
                    playerId={playerId}
                    season={currentSeason}
                    title={t.title}
                    description={t.description ?? ""}
                    category={t.category}
                    initialCompleted={completedThisSeason.has(t.id)}
                    initialNote={currentNotes[t.id] ?? null}
                  />
                ))}
              </div>
            ) : (
              <Card>
                <ListRowGroup className="px-4 py-3">
                  {items.map((t) => {
                    const isDone = completedThisSeason.has(t.id);
                    const note = currentNotes[t.id];
                    const subtitle = [t.description, isDone && note ? `“${note}”` : null].filter(Boolean).join("\n");
                    return (
                      <ListRow
                        key={t.id}
                        leading={
                          // One bg-* at a time: the fill when done, none when not.
                          <span
                            className={`grid size-5 place-items-center rounded-full border-2 ${
                              isDone ? `${meta.fill} border-transparent` : "border-border"
                            }`}
                          >
                            {isDone && <Check className="size-3 text-background" strokeWidth={3} aria-hidden="true" />}
                          </span>
                        }
                        title={
                          <span className={`whitespace-normal ${isDone ? "text-muted-foreground" : ""}`}>
                            {t.title}
                            <span className="sr-only">{isDone ? " — complete" : " — not yet"}</span>
                          </span>
                        }
                        subtitle={subtitle || undefined}
                        wrapSubtitle
                      />
                    );
                  })}
                </ListRowGroup>
              </Card>
            )}
          </div>
        );
      })}
    </section>
  );
}
