import { Target } from "lucide-react";
import { IconTile } from "@/components/ui/icon-tile";
import { ListRow, GroupedSection } from "@/components/ui/list-row";
import { formatDayMonthYear } from "@/lib/time";
import { linkedLabel, phaseChangeText, phaseLabel, verdictLabel, type ObjectiveHistoryItem } from "@/lib/objectives";

/**
 * What the team worked on and how it went: the closed objectives, newest first,
 * with the verdict and how the phase rating moved between the two matches.
 * Coaches only. Renders nothing when there is no history yet.
 */
export function ObjectiveHistory({ items }: Readonly<{ items: ObjectiveHistoryItem[] }>) {
  if (items.length === 0) return null;
  return (
    <GroupedSection title="What we worked on">
      {items.map((o) => {
        const parts = [
          phaseLabel(o.phase),
          linkedLabel(o.linkedCount),
          phaseChangeText(o.phase, o.change),
          o.closedAt ? `Closed ${formatDayMonthYear(o.closedAt)}` : null,
        ];
        return (
          <ListRow
            key={o.id}
            leading={<IconTile tone="blue"><Target aria-hidden="true" /></IconTile>}
            title={o.objective}
            subtitle={parts.filter(Boolean).join(" · ")}
            wrapSubtitle
            trailing={o.verdict ? <span className="text-xs font-semibold">{verdictLabel(o.verdict)}</span> : undefined}
          />
        );
      })}
    </GroupedSection>
  );
}
