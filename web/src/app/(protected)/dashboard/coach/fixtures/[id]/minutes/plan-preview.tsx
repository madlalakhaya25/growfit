import { Card } from "@/components/ui/card";
import type { RotationPlan, RotationSegment } from "@/lib/playing-time";

interface PlanPreviewProps {
  plan: RotationPlan;
  names: Map<string, string>;
  squad: string[];
}

const HALF_NAMES = ["1st half", "2nd half", "3rd period", "4th period"];
export const halfName = (half: number) => HALF_NAMES[half - 1] ?? `Period ${half}`;

/** "12'" or "Half-time" for when a change happens. */
export function changeLabel(seg: Pick<RotationSegment, "half" | "start">): string {
  if (seg.start === 0) return seg.half === 2 ? "Half-time" : `Start of ${halfName(seg.half).toLowerCase()}`;
  return `${halfName(seg.half)} · ${seg.start}'`;
}

function joinNames(ids: string[], names: Map<string, string>): string {
  return ids.map((id) => names.get(id) ?? "Player").join(", ");
}

/** The fair plan: everyone's planned minutes, then each change in order. */
export function PlanPreview({ plan, names, squad }: Readonly<PlanPreviewProps>) {
  const outfield = squad.filter((id) => id !== plan.keeperId);
  const outfieldMinutes = outfield.map((id) => plan.minutes[id] ?? 0);
  const low = Math.min(...outfieldMinutes);
  const high = Math.max(...outfieldMinutes);
  const changes = plan.segments.filter((s) => s.off.length > 0);

  return (
    <section className="space-y-2">
      <h2 className="text-base font-semibold">The plan</h2>
      <Card className="space-y-4 p-4">
        <p className="text-sm">
          {outfield.length > 0 && (low === high
            ? `Everyone plays ${low} minutes.`
            : `Everyone plays ${low} to ${high} minutes.`)}
          {plan.keeperId && ` ${names.get(plan.keeperId) ?? "The keeper"} stays in goal for all ${plan.totalMinutes}.`}
          {changes.length === 0 && " No changes needed."}
        </p>
        <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          {squad.map((id) => (
            <li key={id} className="flex justify-between gap-2">
              <span className="truncate">{names.get(id) ?? "Player"}</span>
              <span className="shrink-0 tabular-nums text-muted-foreground">{plan.minutes[id] ?? 0}&apos;</span>
            </li>
          ))}
        </ul>
        {changes.length > 0 && (
          <ol className="space-y-2 border-t border-border pt-3 text-sm">
            {changes.map((seg) => (
              <li key={`${seg.half}-${seg.start}`}>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{changeLabel(seg)}</p>
                <p>
                  <span className="text-muted-foreground">Off </span>
                  {joinNames(seg.off, names)}
                  <span className="text-muted-foreground"> · On </span>
                  {joinNames(seg.on, names)}
                </p>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </section>
  );
}
