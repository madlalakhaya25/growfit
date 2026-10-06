import Link from "next/link";
import { Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IconTile } from "@/components/ui/icon-tile";
import { ListRow, GroupedSection } from "@/components/ui/list-row";
import { linkedLabel, phaseLabel, planSessionHref, type OpenObjective } from "@/lib/objectives";

/**
 * What each team is working on this week, with a way into planning a session for
 * it. Coaches only: objectives are never shown to families. Renders nothing when
 * there are none, so a database without migration 067 shows no trace of it.
 */
export function ThisWeekObjectives({
  objectives,
  teamNames,
}: Readonly<{ objectives: OpenObjective[]; teamNames?: Record<string, string> }>) {
  if (objectives.length === 0) return null;
  return (
    <GroupedSection title="This week">
      {objectives.map((o) => {
        const phase = phaseLabel(o.phase);
        const team = teamNames?.[o.teamId];
        return (
          <ListRow
            key={o.id}
            leading={<IconTile tone="blue"><Target aria-hidden="true" /></IconTile>}
            title={o.objective}
            subtitle={[team, phase, linkedLabel(o.linkedCount)].filter(Boolean).join(" · ")}
            wrapSubtitle
            trailing={
              <Button asChild size="sm" variant="outline">
                <Link href={planSessionHref(o)}>Plan a session</Link>
              </Button>
            }
          />
        );
      })}
    </GroupedSection>
  );
}
