import { Calendar, ClipboardList, GraduationCap, Target } from "lucide-react";
import { GroupedSection, ListRow } from "@/components/ui/list-row";
import { IconTile } from "@/components/ui/icon-tile";
import { formatTime, formatWeekdayDayMonth } from "@/lib/time";
import type { AdminCard } from "@/lib/staff-hats";
import type { DirectorCards } from "@/lib/director-data";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** The director and technical director cards on the admin's Today page. A card with no data (not loaded, or nothing to say) is simply absent. */
export function DirectorCardList({
  cards, data, coverageHref = "/dashboard/admin/academy?tab=coverage",
}: Readonly<{ cards: readonly AdminCard[]; data: DirectorCards; /** Where a coverage row goes; null for a coach, who cannot open the admin page. */ coverageHref?: string | null }>) {
  return (
    <>
      {cards.includes("fixtures") && data.fixtures && data.fixtures.length > 0 && (
        <GroupedSection title="This week's matches">
          {data.fixtures.map((f) => (
            <ListRow
              key={`${f.teamName}-${f.kickoff}`}
              leading={<IconTile tone="orange"><Calendar aria-hidden="true" /></IconTile>}
              title={`${f.teamName} v ${f.opponent}`}
              subtitle={`${formatWeekdayDayMonth(new Date(f.kickoff))}, ${formatTime(new Date(f.kickoff))}`}
            />
          ))}
        </GroupedSection>
      )}
      {cards.includes("objectives") && data.objectives && data.objectives.length > 0 && (
        <GroupedSection title="Open objectives">
          {data.objectives.map((o) => (
            <ListRow
              key={o.teamId}
              leading={<IconTile tone="red"><Target aria-hidden="true" /></IconTile>}
              title={`${o.name}: ${plural(o.open, "objective", "objectives")} open`}
              subtitle={o.noTrainingYet > 0 ? `${o.noTrainingYet} with no training planned after a week` : "Training planned for all"}
            />
          ))}
        </GroupedSection>
      )}
      {cards.includes("coverage") && data.coverage && data.coverage.length > 0 && (
        <GroupedSection title="Curriculum coverage this term">
          {data.coverage.map((c) => (
            <ListRow
              key={c.ageGroup}
              leading={<IconTile tone="orange"><GraduationCap aria-hidden="true" /></IconTile>}
              title={`${c.ageGroup}: ${c.percent}% trained`}
              subtitle={`${c.notTouched} of ${c.items} not touched yet`}
              href={coverageHref ?? undefined}
            />
          ))}
        </GroupedSection>
      )}
      {cards.includes("sessions") && data.sessions && data.sessions.length > 0 && (
        <GroupedSection title="Sessions this term">
          {data.sessions.map((s) => (
            <ListRow
              key={s.teamId}
              leading={<IconTile tone="orange"><ClipboardList aria-hidden="true" /></IconTile>}
              title={`${s.name}: ${plural(s.sessions, "session", "sessions")}`}
            />
          ))}
        </GroupedSection>
      )}
    </>
  );
}
